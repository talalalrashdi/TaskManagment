using System.Security.Claims;

namespace TechFlowPM.API.Helpers;

public static class Policies
{
    public const string AdminOnly = nameof(AdminOnly);
    public const string Management = nameof(Management);
    public const string WorkspaceUser = nameof(WorkspaceUser);
}

public sealed class AppException(string message, int statusCode, IReadOnlyCollection<string>? errors = null) : Exception(message)
{
    public int StatusCode { get; } = statusCode;

    public IReadOnlyCollection<string> Errors { get; } = errors ?? [];
}

public static class CacheKeys
{
    public const string DashboardStats = "dashboard:stats";
    public const string ExpiringLicenses = "licenses:expiring";
    public const string Users = "users:list";
    public const string UsersVersion = "users:list:version";
}

public static class AuthDevices
{
    public const string PasswordLogin = "PASSWORD-LOGIN";
}

public static class HubGroups
{
    public static string Project(int projectId) => $"project-{projectId}";
}

public interface ICurrentUserService
{
    int? UserId { get; }
    string? Role { get; }
    string? DeviceName { get; }
    string? IpAddress { get; }
}

public sealed class CurrentUserService(IHttpContextAccessor httpContextAccessor) : ICurrentUserService
{
    public int? UserId
        => int.TryParse(httpContextAccessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId)
            ? userId
            : null;

    public string? Role => httpContextAccessor.HttpContext?.User.FindFirstValue(ClaimTypes.Role);

    public string? DeviceName => httpContextAccessor.HttpContext?.User.FindFirstValue("device_name");

    public string? IpAddress => httpContextAccessor.HttpContext?.Connection.RemoteIpAddress?.ToString();
}
