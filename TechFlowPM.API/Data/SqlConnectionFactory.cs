using System.Data;
using Microsoft.Data.SqlClient;

namespace TechFlowPM.API.Data;

public interface ISqlConnectionFactory
{
    IDbConnection CreateConnection();
}

internal static class SqlConnectionSettings
{
    public static string ResolveConnectionString(IConfiguration configuration)
    {
        var host = configuration["SqlServer:Host"];
        var port = configuration["SqlServer:Port"] ?? "1433";
        var database = configuration["SqlServer:Database"] ?? "TechFlowPM";
        var user = configuration["SqlServer:User"] ?? "sa";
        var password = configuration["SqlServer:Password"];

        // Prefer explicit environment-driven SQL Server settings when present.
        // This allows hosted environments such as Render to override the local
        // development connection string defined in appsettings.json.
        if (!string.IsNullOrWhiteSpace(host) && !string.IsNullOrWhiteSpace(password))
        {
            return new SqlConnectionStringBuilder
            {
                DataSource = $"{host},{port}",
                InitialCatalog = database,
                UserID = user,
                Password = password,
                TrustServerCertificate = true,
                Encrypt = false
            }.ConnectionString;
        }

        var configured = configuration.GetConnectionString("Default");
        if (!string.IsNullOrWhiteSpace(configured))
        {
            return configured;
        }

        throw new InvalidOperationException("Database connection string is missing.");
    }
}

public sealed class SqlConnectionFactory(IConfiguration configuration) : ISqlConnectionFactory
{
    private readonly string _connectionString = SqlConnectionSettings.ResolveConnectionString(configuration);

    public IDbConnection CreateConnection() => new SqlConnection(_connectionString);
}
