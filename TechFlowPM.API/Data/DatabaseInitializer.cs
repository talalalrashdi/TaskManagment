using System.Text;
using Dapper;
using Microsoft.Data.SqlClient;

namespace TechFlowPM.API.Data;

public static class DatabaseInitializer
{
    public static async Task InitializeDatabaseAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var configuration = scope.ServiceProvider.GetRequiredService<IConfiguration>();
        var logger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("DatabaseInitializer");

        var connectionString = configuration.GetConnectionString("Default")
            ?? throw new InvalidOperationException("Connection string 'Default' was not found.");

        var builder = new SqlConnectionStringBuilder(connectionString);
        var databaseName = builder.InitialCatalog;

        builder.InitialCatalog = "master";

        await using (var masterConnection = new SqlConnection(builder.ConnectionString))
        {
            await masterConnection.OpenAsync();
            await masterConnection.ExecuteAsync(
                $"IF DB_ID(N'{databaseName}') IS NULL CREATE DATABASE [{databaseName}];");
        }

        await using var appConnection = new SqlConnection(connectionString);
        await appConnection.OpenAsync();

        var scriptDirectory = Path.Combine(AppContext.BaseDirectory, "Data", "Scripts");
        if (!Directory.Exists(scriptDirectory))
        {
            logger.LogWarning("SQL script directory not found at {ScriptDirectory}", scriptDirectory);
            return;
        }

        foreach (var scriptFile in Directory.GetFiles(scriptDirectory, "*.sql").OrderBy(static file => file))
        {
            var content = await File.ReadAllTextAsync(scriptFile);
            foreach (var batch in SplitSqlBatches(content))
            {
                if (string.IsNullOrWhiteSpace(batch))
                {
                    continue;
                }

                await appConnection.ExecuteAsync(batch);
            }

            logger.LogInformation("Executed SQL script {ScriptFile}", Path.GetFileName(scriptFile));
        }
    }

    private static IEnumerable<string> SplitSqlBatches(string sql)
    {
        var builder = new StringBuilder();
        using var reader = new StringReader(sql);

        while (reader.ReadLine() is { } line)
        {
            if (line.Trim().Equals("GO", StringComparison.OrdinalIgnoreCase))
            {
                yield return builder.ToString();
                builder.Clear();
                continue;
            }

            builder.AppendLine(line);
        }

        if (builder.Length > 0)
        {
            yield return builder.ToString();
        }
    }
}
