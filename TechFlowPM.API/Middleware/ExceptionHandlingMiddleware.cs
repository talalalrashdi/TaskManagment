using System.Net;
using System.Text.Json;
using FluentValidation;
using TechFlowPM.API.DTOs;
using TechFlowPM.API.Helpers;

namespace TechFlowPM.API.Middleware;

public sealed class ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Unhandled exception for {Method} {Path}", context.Request.Method, context.Request.Path);
            await HandleExceptionAsync(context, exception);
        }
    }

    private static async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        var response = exception switch
        {
            ValidationException validationException => new
            {
                StatusCode = (int)HttpStatusCode.BadRequest,
                Body = ApiResponse<object?>.Failure(
                    "Validation failed.",
                    validationException.Errors.Select(static error => error.ErrorMessage).ToArray())
            },
            AppException appException => new
            {
                StatusCode = appException.StatusCode,
                Body = ApiResponse<object?>.Failure(appException.Message, appException.Errors.ToArray())
            },
            _ => new
            {
                StatusCode = (int)HttpStatusCode.InternalServerError,
                Body = ApiResponse<object?>.Failure("An unexpected server error occurred.")
            }
        };

        context.Response.StatusCode = response.StatusCode;
        context.Response.ContentType = "application/json";

        await context.Response.WriteAsync(JsonSerializer.Serialize(response.Body));
    }
}
