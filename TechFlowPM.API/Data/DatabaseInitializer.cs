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

        var connectionString = SqlConnectionSettings.ResolveConnectionString(configuration);

        var builder = new SqlConnectionStringBuilder(connectionString);
        var databaseName = builder.InitialCatalog;

        builder.InitialCatalog = "master";

        await ExecuteWithRetryAsync(
            logger,
            async () =>
            {
                await using var masterConnection = new SqlConnection(builder.ConnectionString);
                await masterConnection.OpenAsync();
                await masterConnection.ExecuteAsync(
                    $"IF DB_ID(N'{databaseName}') IS NULL CREATE DATABASE [{databaseName}];");
            });

        await using var appConnection = new SqlConnection(connectionString);
        await ExecuteWithRetryAsync(
            logger,
            async () =>
            {
                if (appConnection.State != System.Data.ConnectionState.Open)
                {
                    await appConnection.OpenAsync();
                }
            });

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

    private static async Task ExecuteWithRetryAsync(ILogger logger, Func<Task> action)
    {
        const int maxAttempts = 12;
        var delay = TimeSpan.FromSeconds(5);

        for (var attempt = 1; attempt <= maxAttempts; attempt++)
        {
            try
            {
                await action();
                return;
            }
            catch (SqlException ex) when (attempt < maxAttempts)
            {
                logger.LogWarning(
                    ex,
                    "Database is not ready yet. Retrying initialization attempt {Attempt} of {MaxAttempts} in {DelaySeconds} seconds.",
                    attempt,
                    maxAttempts,
                    delay.TotalSeconds);

                await Task.Delay(delay);
            }
        }

        await action();
    }
}
