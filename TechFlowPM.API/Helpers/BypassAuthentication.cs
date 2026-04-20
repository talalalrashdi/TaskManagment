using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace TechFlowPM.API.Helpers;

public sealed class AuthenticationOptions
{
    public bool BypassEnabled { get; init; }
    public int BypassUserId { get; init; } = 1;
    public string BypassName { get; init; } = "System Admin";
    public string BypassEmail { get; init; } = "admin@techflow.local";
    public string BypassRole { get; init; } = "Admin";
    public string BypassDeviceName { get; init; } = "BYPASS-DEV";
}

public sealed class BypassAuthenticationHandler(
    IOptionsMonitor<Microsoft.AspNetCore.Authentication.AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    IOptions<AuthenticationOptions> authenticationOptions)
    : AuthenticationHandler<Microsoft.AspNetCore.Authentication.AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "BypassAuthentication";

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var settings = authenticationOptions.Value;
        if (!settings.BypassEnabled)
        {
            return Task.FromResult(AuthenticateResult.NoResult());
        }

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, settings.BypassUserId.ToString()),
            new Claim(ClaimTypes.Name, settings.BypassName),
            new Claim(ClaimTypes.Email, settings.BypassEmail),
            new Claim(ClaimTypes.Role, settings.BypassRole),
            new Claim("device_name", settings.BypassDeviceName),
            new Claim("auth_mode", "bypass")
        };

        var identity = new ClaimsIdentity(claims, SchemeName);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, SchemeName);
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
