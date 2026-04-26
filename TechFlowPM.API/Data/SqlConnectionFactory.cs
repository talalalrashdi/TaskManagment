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
        var configured = configuration.GetConnectionString("Default");
        if (!string.IsNullOrWhiteSpace(configured))
        {
            return configured;
        }

        var host = configuration["SqlServer:Host"];
        var port = configuration["SqlServer:Port"] ?? "1433";
        var database = configuration["SqlServer:Database"] ?? "TechFlowPM";
        var user = configuration["SqlServer:User"] ?? "sa";
        var password = configuration["SqlServer:Password"];

        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(password))
        {
            throw new InvalidOperationException("Database connection string is missing.");
        }

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
}

public sealed class SqlConnectionFactory(IConfiguration configuration) : ISqlConnectionFactory
{
    private readonly string _connectionString = SqlConnectionSettings.ResolveConnectionString(configuration);

    public IDbConnection CreateConnection() => new SqlConnection(_connectionString);
}
