using System.Net;
using System.Net.Sockets;
using System.Security.Claims;
using System.Text;
using FluentValidation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using TechFlowPM.API.Data;
using TechFlowPM.API.DTOs;
using TechFlowPM.API.Helpers;
using TechFlowPM.API.Models;
using TechFlowPM.API.Repositories;
using TechFlowPM.API.Services;

namespace TechFlowPM.API.Extensions;

public static class DependencyInjection
{
    public static IServiceCollection AddTechFlowPm(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<JwtOptions>(configuration.GetSection("Jwt"));
        services.Configure<EncryptionOptions>(configuration.GetSection("Encryption"));
        services.Configure<AuthenticationOptions>(configuration.GetSection("Authentication"));

        services.AddHttpContextAccessor();
        services.AddMemoryCache();
        services.AddSignalR();
        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen(ConfigureSwagger);
        services.AddValidatorsFromAssemblyContaining<DeviceLoginRequestValidator>();
        ConfigureCors(services, configuration);

        services.AddSingleton<ISqlConnectionFactory, SqlConnectionFactory>();
        services.AddScoped<ICurrentUserService, CurrentUserService>();
        services.AddScoped<IPasswordHasher, PasswordHasher>();
        services.AddScoped<IEncryptionService, AesEncryptionService>();
        services.AddScoped<IDeviceLoginThrottleService, DeviceLoginThrottleService>();

        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IProjectRepository, ProjectRepository>();
        services.AddScoped<ITaskRepository, TaskRepository>();
        services.AddScoped<IExecutiveUpdateRepository, ExecutiveUpdateRepository>();
        services.AddScoped<ILicenseRepository, LicenseRepository>();
        services.AddScoped<INotificationRepository, NotificationRepository>();
        services.AddScoped<IAuthRepository, AuthRepository>();
        services.AddScoped<IDeviceRepository, DeviceRepository>();
        services.AddScoped<IAuditLogRepository, AuditLogRepository>();

        services.AddScoped<IJwtTokenService, JwtTokenService>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IProjectService, ProjectService>();
        services.AddScoped<ITaskService, TaskService>();
        services.AddScoped<ILicenseService, LicenseService>();
        services.AddScoped<INotificationService, NotificationService>();
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<IDeviceAdminService, DeviceAdminService>();

        ConfigureAuthentication(services, configuration);
        ConfigureAuthorization(services);

        return services;
    }

    private static void ConfigureCors(IServiceCollection services, IConfiguration configuration)
    {
        var origins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
            ?.Where(static origin => !string.IsNullOrWhiteSpace(origin))
            .ToArray();
        var allowAnyLocalOrigin = configuration.GetValue("Cors:AllowAnyLocalOrigin", true);

        origins = origins is { Length: > 0 }
            ? origins
            : ["http://localhost:3000", "http://127.0.0.1:3000"];

        services.AddCors(options =>
        {
            options.AddPolicy("AppCors", policy =>
            {
                policy
                    .SetIsOriginAllowed(origin => IsAllowedOrigin(origin, origins, allowAnyLocalOrigin))
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials();
            });
        });
    }

    private static bool IsAllowedOrigin(string? origin, IReadOnlyCollection<string> configuredOrigins, bool allowAnyLocalOrigin)
    {
        if (string.IsNullOrWhiteSpace(origin))
        {
            return false;
        }

        if (configuredOrigins.Contains(origin, StringComparer.OrdinalIgnoreCase))
        {
            return true;
        }

        if (!allowAnyLocalOrigin || !Uri.TryCreate(origin, UriKind.Absolute, out var uri))
        {
            return false;
        }

        if (!uri.Scheme.Equals(Uri.UriSchemeHttp, StringComparison.OrdinalIgnoreCase)
            && !uri.Scheme.Equals(Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        if (uri.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (!IPAddress.TryParse(uri.Host, out var address))
        {
            return false;
        }

        if (IPAddress.IsLoopback(address))
        {
            return true;
        }

        if (address.AddressFamily != AddressFamily.InterNetwork)
        {
            return false;
        }

        var bytes = address.GetAddressBytes();

        return bytes[0] == 10
            || (bytes[0] == 192 && bytes[1] == 168)
            || (bytes[0] == 172 && bytes[1] is >= 16 and <= 31);
    }

    private static void ConfigureAuthentication(IServiceCollection services, IConfiguration configuration)
    {
        var jwtOptions = configuration.GetSection("Jwt").Get<JwtOptions>()
            ?? throw new InvalidOperationException("JWT configuration is missing.");
        var authenticationOptions = configuration.GetSection("Authentication").Get<AuthenticationOptions>()
            ?? new AuthenticationOptions();

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.Key));

        services
            .AddAuthentication(options =>
            {
                options.DefaultScheme = "SmartAuth";
                options.DefaultAuthenticateScheme = "SmartAuth";
                options.DefaultChallengeScheme = "SmartAuth";
            })
            .AddPolicyScheme("SmartAuth", "Smart authentication", options =>
            {
                options.ForwardDefaultSelector = context =>
                {
                    var authorizationHeader = context.Request.Headers.Authorization.ToString();
                    var hasBearerToken = authorizationHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase);

                    if (hasBearerToken)
                    {
                        return JwtBearerDefaults.AuthenticationScheme;
                    }

                    return authenticationOptions.BypassEnabled
                        ? BypassAuthenticationHandler.SchemeName
                        : JwtBearerDefaults.AuthenticationScheme;
                };
            })
            .AddJwtBearer(options =>
            {
                options.RequireHttpsMetadata = false;
                options.SaveToken = true;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidateAudience = true,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    ValidIssuer = jwtOptions.Issuer,
                    ValidAudience = jwtOptions.Audience,
                    IssuerSigningKey = key,
                    ClockSkew = TimeSpan.FromMinutes(1),
                    NameClaimType = ClaimTypes.Name,
                    RoleClaimType = ClaimTypes.Role
                };

                options.Events = new JwtBearerEvents
                {
                    OnTokenValidated = async context =>
                    {
                        var authRepository = context.HttpContext.RequestServices.GetRequiredService<IAuthRepository>();
                        var userIdClaim = context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
                        var deviceName = context.Principal?.FindFirstValue("device_name");
                        var jti = context.Principal?.FindFirstValue("jti");

                        if (!int.TryParse(userIdClaim, out var userId) || string.IsNullOrWhiteSpace(deviceName))
                        {
                            context.Fail("Invalid token.");
                            return;
                        }

                        if (!string.IsNullOrWhiteSpace(jti) && await authRepository.IsTokenRevokedAsync(jti))
                        {
                            context.Fail("Token has been revoked.");
                            return;
                        }

                        if (deviceName != AuthDevices.PasswordLogin)
                        {
                            var isAuthorized = await authRepository.IsDeviceAuthorizedAsync(deviceName, userId);
                            if (!isAuthorized)
                            {
                                context.Fail("Device is no longer authorized.");
                            }
                        }
                    }
                };
            })
            .AddScheme<Microsoft.AspNetCore.Authentication.AuthenticationSchemeOptions, BypassAuthenticationHandler>(
                BypassAuthenticationHandler.SchemeName,
                _ => { });
    }

    private static void ConfigureAuthorization(IServiceCollection services)
    {
        services.AddAuthorization(options =>
        {
            options.AddPolicy(Policies.AdminOnly, policy => policy.RequireRole(SystemRoles.Admin));
            options.AddPolicy(Policies.Management, policy => policy.RequireRole(SystemRoles.Admin, SystemRoles.ProjectManager));
            options.AddPolicy(
                Policies.WorkspaceUser,
                policy => policy.RequireRole(SystemRoles.Admin, SystemRoles.ProjectManager, SystemRoles.Member, SystemRoles.Viewer));
        });
    }

    private static void ConfigureSwagger(Swashbuckle.AspNetCore.SwaggerGen.SwaggerGenOptions options)
    {
        options.SwaggerDoc("v1", new OpenApiInfo
        {
            Title = "TechFlow PM API",
            Version = "v1",
            Description = "Internal project management and integration API for software, networks, cybersecurity, and maintenance teams."
        });

        var securityScheme = new OpenApiSecurityScheme
        {
            Name = "Authorization",
            Description = "Enter JWT Bearer token",
            In = ParameterLocation.Header,
            Type = SecuritySchemeType.Http,
            Scheme = "bearer",
            BearerFormat = "JWT",
            Reference = new OpenApiReference
            {
                Type = ReferenceType.SecurityScheme,
                Id = JwtBearerDefaults.AuthenticationScheme
            }
        };

        options.AddSecurityDefinition(JwtBearerDefaults.AuthenticationScheme, securityScheme);
        options.AddSecurityRequirement(new OpenApiSecurityRequirement
        {
            {
                securityScheme,
                Array.Empty<string>()
            }
        });
    }
}
