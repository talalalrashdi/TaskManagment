using Microsoft.Extensions.Hosting;

namespace TechFlowPM.API.Data;

public sealed class DatabaseInitializationWorker(
    IServiceProvider services,
    ILogger<DatabaseInitializationWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await services.InitializeDatabaseAsync();
                logger.LogInformation("Database initialization completed successfully.");
                return;
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogWarning(
                    ex,
                    "Database initialization is still pending. Retrying in 15 seconds.");

                try
                {
                    await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    return;
                }
            }
        }
    }
}
