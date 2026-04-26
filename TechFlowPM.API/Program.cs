using Serilog;
using TechFlowPM.API.Controllers;
using TechFlowPM.API.Data;
using TechFlowPM.API.Extensions;
using TechFlowPM.API.Hubs;
using TechFlowPM.API.Middleware;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, services, configuration) =>
{
    configuration
        .ReadFrom.Configuration(context.Configuration)
        .ReadFrom.Services(services)
        .Enrich.FromLogContext();
});

builder.Services.AddTechFlowPm(builder.Configuration);

var app = builder.Build();

app.UseSerilogRequestLogging();
app.UseMiddleware<ExceptionHandlingMiddleware>();

if (app.Environment.IsDevelopment() || app.Environment.IsProduction())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

if (app.Configuration.GetValue<bool>("Web:UseHttpsRedirection"))
{
    app.UseHttpsRedirection();
}

app.UseCors("AppCors");
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/", () => Results.Ok(new
{
    name = "TechFlow PM API",
    version = "v1",
    status = "running"
}))
.WithName("Health");

app.MapHub<ProjectHub>("/hubs/projects");
app.MapApiV1();

app.Run();
