using System.Data;
using Microsoft.Data.SqlClient;

namespace TechFlowPM.API.Data;

public interface ISqlConnectionFactory
{
    IDbConnection CreateConnection();
}

public sealed class SqlConnectionFactory(IConfiguration configuration) : ISqlConnectionFactory
{
    private readonly string _connectionString =
        configuration.GetConnectionString("Default")
        ?? throw new InvalidOperationException("Database connection string is missing.");

    public IDbConnection CreateConnection() => new SqlConnection(_connectionString);
}
