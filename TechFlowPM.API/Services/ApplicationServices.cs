using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using TechFlowPM.API.DTOs;
using TechFlowPM.API.Helpers;
using TechFlowPM.API.Hubs;
using TechFlowPM.API.Models;
using TechFlowPM.API.Repositories;

namespace TechFlowPM.API.Services;

public interface IDeviceLoginThrottleService
{
    (bool IsBlocked, TimeSpan? RetryAfter) GetStatus(string deviceName);
    void RegisterFailure(string deviceName);
    void Reset(string deviceName);
}

public interface IJwtTokenService
{
    (string Token, string Jti, DateTime ExpiresAtUtc) GenerateAccessToken(UserEntity user, string deviceName);
    (string Token, DateTime ExpiresAtUtc) GenerateRefreshToken();
}

public interface IAuthService
{
    Task<AuthResponse> DeviceLoginAsync(DeviceLoginRequest request, CancellationToken cancellationToken = default);
    Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default);
    Task<AuthResponse> RefreshAsync(RefreshTokenRequest request, CancellationToken cancellationToken = default);
    Task LogoutAsync(LogoutRequest request, ClaimsPrincipal principal, CancellationToken cancellationToken = default);
}

public interface IProjectService
{
    Task<PagedResult<ProjectListItemDto>> GetProjectsAsync(ProjectQueryParameters query, CancellationToken cancellationToken = default);
    Task<ProjectDetailDto> GetProjectAsync(int id, CancellationToken cancellationToken = default);
    Task<ProjectDetailDto> CreateProjectAsync(CreateProjectRequest request, CancellationToken cancellationToken = default);
    Task<ProjectDetailDto> UpdateProjectAsync(int id, UpdateProjectRequest request, CancellationToken cancellationToken = default);
    Task DeleteProjectAsync(int id, CancellationToken cancellationToken = default);
    Task<ProjectSummaryDto> GetSummaryAsync(int projectId, CancellationToken cancellationToken = default);
    Task<IReadOnlyCollection<ProjectTimelineItemDto>> GetTimelineAsync(TimelineQueryParameters query, CancellationToken cancellationToken = default);
    Task<DashboardStatsDto> GetDashboardStatsAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyCollection<ProjectMemberDto>> GetProjectMembersAsync(int projectId, CancellationToken cancellationToken = default);
    Task<ProjectMemberDto> AddProjectMemberAsync(int projectId, AddProjectMemberRequest request, CancellationToken cancellationToken = default);
    Task RemoveProjectMemberAsync(int projectId, int userId, CancellationToken cancellationToken = default);
    Task<IReadOnlyCollection<ExecutiveUpdateDto>> GetProjectUpdatesAsync(int projectId, CancellationToken cancellationToken = default);
    Task<ExecutiveUpdateDto> AddProjectUpdateAsync(int projectId, CreateExecutiveUpdateRequest request, CancellationToken cancellationToken = default);
    Task DeleteProjectUpdateAsync(int projectId, int updateId, CancellationToken cancellationToken = default);
}

public interface ITaskService
{
    Task<IReadOnlyCollection<TaskDto>> GetProjectTasksAsync(int projectId, CancellationToken cancellationToken = default);
    Task<TaskDto> CreateTaskAsync(int projectId, CreateTaskRequest request, CancellationToken cancellationToken = default);
    Task<TaskDto> UpdateTaskAsync(int id, UpdateTaskRequest request, CancellationToken cancellationToken = default);
    Task<TaskDto> UpdateTaskStatusAsync(int id, UpdateTaskStatusRequest request, CancellationToken cancellationToken = default);
    Task DeleteTaskAsync(int id, CancellationToken cancellationToken = default);
}

public interface ILicenseService
{
    Task<PagedResult<LicenseDto>> GetLicensesAsync(LicenseQueryParameters query, CancellationToken cancellationToken = default);
    Task<IReadOnlyCollection<LicenseDto>> GetExpiringSoonAsync(int days, CancellationToken cancellationToken = default);
    Task<LicenseDto> CreateAsync(CreateLicenseRequest request, CancellationToken cancellationToken = default);
    Task<LicenseDto> UpdateAsync(int id, UpdateLicenseRequest request, CancellationToken cancellationToken = default);
    Task DeleteAsync(int id, CancellationToken cancellationToken = default);
}

public interface INotificationService
{
    Task<PagedResult<NotificationDto>> GetNotificationsAsync(NotificationQueryParameters query, CancellationToken cancellationToken = default);
    Task<int> MarkReadAsync(MarkNotificationsReadRequest request, CancellationToken cancellationToken = default);
}

public interface IUserService
{
    Task<PagedResult<UserDto>> GetUsersAsync(UserQueryParameters query, CancellationToken cancellationToken = default);
    Task<UserDto> CreateUserAsync(CreateUserRequest request, CancellationToken cancellationToken = default);
    Task<UserDto> UpdateUserAsync(int id, UpdateUserRequest request, CancellationToken cancellationToken = default);
}

public interface IDepartmentService
{
    Task<IReadOnlyCollection<DepartmentDto>> GetDepartmentsAsync(CancellationToken cancellationToken = default);
    Task<DepartmentDto> CreateDepartmentAsync(CreateDepartmentRequest request, CancellationToken cancellationToken = default);
}

public interface IDeviceAdminService
{
    Task<PagedResult<RegisteredDeviceDto>> GetDevicesAsync(DeviceQueryParameters query, CancellationToken cancellationToken = default);
    Task<RegisteredDeviceDto> RegisterAsync(RegisterDeviceRequest request, CancellationToken cancellationToken = default);
    Task<RegisteredDeviceDto> ToggleAsync(int id, ToggleDeviceRequest request, CancellationToken cancellationToken = default);
    Task DeleteAsync(int id, CancellationToken cancellationToken = default);
}

public sealed class DeviceLoginThrottleService(IMemoryCache cache) : IDeviceLoginThrottleService
{
    private static readonly TimeSpan FailureWindow = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan LockWindow = TimeSpan.FromMinutes(15);
    private const int FailureLimit = 10;

    public (bool IsBlocked, TimeSpan? RetryAfter) GetStatus(string deviceName)
    {
        if (!cache.TryGetValue(GetKey(deviceName), out ThrottleState? state) || state is null)
        {
            return (false, null);
        }

        if (state.BlockedUntilUtc is { } blockedUntil && blockedUntil > DateTime.UtcNow)
        {
            return (true, blockedUntil - DateTime.UtcNow);
        }

        if (state.BlockedUntilUtc is { } expiredBlock && expiredBlock <= DateTime.UtcNow)
        {
            cache.Remove(GetKey(deviceName));
        }

        return (false, null);
    }

    public void RegisterFailure(string deviceName)
    {
        var now = DateTime.UtcNow;
        var key = GetKey(deviceName);
        var state = cache.Get<ThrottleState>(key) ?? new ThrottleState();

        if (state.FirstFailureUtc is null || state.FirstFailureUtc.Value.Add(FailureWindow) < now)
        {
            state = new ThrottleState
            {
                Count = 1,
                FirstFailureUtc = now
            };
        }
        else
        {
            state.Count++;
        }

        if (state.Count >= FailureLimit)
        {
            state.BlockedUntilUtc = now.Add(LockWindow);
        }

        cache.Set(key, state, state.BlockedUntilUtc ?? now.Add(FailureWindow));
    }

    public void Reset(string deviceName) => cache.Remove(GetKey(deviceName));

    private static string GetKey(string deviceName) => $"device-throttle:{deviceName}";

    private sealed class ThrottleState
    {
        public int Count { get; set; }
        public DateTime? FirstFailureUtc { get; set; }
        public DateTime? BlockedUntilUtc { get; set; }
    }
}

public sealed class JwtTokenService(IOptions<JwtOptions> jwtOptions) : IJwtTokenService
{
    private readonly JwtOptions _jwtOptions = jwtOptions.Value;

    public (string Token, string Jti, DateTime ExpiresAtUtc) GenerateAccessToken(UserEntity user, string deviceName)
    {
        var expiresAt = DateTime.UtcNow.AddMinutes(_jwtOptions.AccessTokenMinutes);
        var jti = Guid.NewGuid().ToString("N");
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtOptions.Key));

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.Name),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Role, user.Role),
            new("device_name", deviceName),
            new(JwtRegisteredClaimNames.Jti, jti)
        };

        var token = new JwtSecurityToken(
            issuer: _jwtOptions.Issuer,
            audience: _jwtOptions.Audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: expiresAt,
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));

        return (new JwtSecurityTokenHandler().WriteToken(token), jti, expiresAt);
    }

    public (string Token, DateTime ExpiresAtUtc) GenerateRefreshToken()
    {
        var buffer = RandomNumberGenerator.GetBytes(64);
        return (Convert.ToBase64String(buffer), DateTime.UtcNow.AddDays(_jwtOptions.RefreshTokenDays));
    }
}

public sealed class AuthService(
    IUserRepository userRepository,
    IAuthRepository authRepository,
    IAuditLogRepository auditLogRepository,
    IJwtTokenService jwtTokenService,
    IPasswordHasher passwordHasher,
    ICurrentUserService currentUserService,
    IDeviceLoginThrottleService throttleService) : IAuthService
{
    public async Task<AuthResponse> DeviceLoginAsync(DeviceLoginRequest request, CancellationToken cancellationToken = default)
    {
        var deviceName = NormalizeDeviceName(request.DeviceName);
        var throttleStatus = throttleService.GetStatus(deviceName);
        if (throttleStatus.IsBlocked)
        {
            throw new AppException(
                "Too many failed attempts. Device login is temporarily blocked.",
                StatusCodes.Status429TooManyRequests,
                [throttleStatus.RetryAfter is null ? "Please retry later." : $"Retry after {Math.Ceiling(throttleStatus.RetryAfter.Value.TotalMinutes)} minutes."]);
        }

        var device = await authRepository.GetDeviceByNameAsync(deviceName, cancellationToken);
        if (device is null || !device.IsActive)
        {
            throttleService.RegisterFailure(deviceName);
            await WriteAuditAsync(null, "DeviceLoginFailed", "RegisteredDevice", deviceName, new { deviceName, success = false }, cancellationToken);
            throw new AppException("الجهاز غير مصرح له", StatusCodes.Status401Unauthorized);
        }

        var user = await userRepository.GetByIdAsync(device.UserId, cancellationToken)
            ?? throw new AppException("Associated user was not found.", StatusCodes.Status401Unauthorized);

        throttleService.Reset(deviceName);
        await authRepository.UpdateLastLoginAsync(device.Id, DateTime.UtcNow, cancellationToken);
        var response = await CreateAuthResponseAsync(user, deviceName, cancellationToken);

        await WriteAuditAsync(user.Id, "DeviceLoginSucceeded", "RegisteredDevice", deviceName, new { deviceName, success = true }, cancellationToken);
        return response;
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default)
    {
        var user = await userRepository.GetByEmailAsync(request.Email.Trim(), cancellationToken);
        if (user is null || !passwordHasher.Verify(request.Password, user.PasswordHash))
        {
            await WriteAuditAsync(null, "PasswordLoginFailed", "User", request.Email.Trim(), new { email = request.Email.Trim(), success = false }, cancellationToken);
            throw new AppException("Invalid email or password.", StatusCodes.Status401Unauthorized);
        }

        var deviceName = NormalizeDeviceName(currentUserService.DeviceName ?? AuthDevices.PasswordLogin);
        var response = await CreateAuthResponseAsync(user, deviceName, cancellationToken);
        await WriteAuditAsync(user.Id, "PasswordLoginSucceeded", "User", user.Id.ToString(), new { user.Email, success = true }, cancellationToken);
        return response;
    }

    public async Task<AuthResponse> RefreshAsync(RefreshTokenRequest request, CancellationToken cancellationToken = default)
    {
        var refreshToken = await authRepository.GetRefreshTokenAsync(request.RefreshToken, cancellationToken);
        if (refreshToken is null || refreshToken.RevokedAt is not null || refreshToken.ExpiresAt <= DateTime.UtcNow)
        {
            throw new AppException("Refresh token is invalid or expired.", StatusCodes.Status401Unauthorized);
        }

        var user = await userRepository.GetByIdAsync(refreshToken.UserId, cancellationToken)
            ?? throw new AppException("User not found.", StatusCodes.Status401Unauthorized);

        var isAuthorized = await authRepository.IsDeviceAuthorizedAsync(refreshToken.DeviceName, user.Id, cancellationToken);
        if (!isAuthorized)
        {
            throw new AppException("Device is no longer authorized.", StatusCodes.Status401Unauthorized);
        }

        var response = await CreateAuthResponseAsync(user, refreshToken.DeviceName, cancellationToken, request.RefreshToken);
        return response;
    }

    public async Task LogoutAsync(LogoutRequest request, ClaimsPrincipal principal, CancellationToken cancellationToken = default)
    {
        var jti = principal.FindFirstValue(JwtRegisteredClaimNames.Jti);
        var deviceName = principal.FindFirstValue("device_name");
        var userId = int.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var parsedUserId)
            ? parsedUserId
            : currentUserService.UserId;
        var expClaim = principal.FindFirstValue(JwtRegisteredClaimNames.Exp);
        var expiresAt = long.TryParse(expClaim, out var expUnix)
            ? DateTimeOffset.FromUnixTimeSeconds(expUnix).UtcDateTime
            : DateTime.UtcNow.AddHours(8);

        await authRepository.RevokeRefreshTokenAsync(request.RefreshToken, DateTime.UtcNow, null, cancellationToken);

        if (!string.IsNullOrWhiteSpace(jti))
        {
            await authRepository.RevokeAccessTokenAsync(
                new RevokedTokenEntity
                {
                    Jti = jti,
                    UserId = userId,
                    DeviceName = deviceName,
                    Reason = "Logout",
                    ExpiresAt = expiresAt,
                    RevokedAt = DateTime.UtcNow
                },
                cancellationToken);
        }

        await WriteAuditAsync(userId, "Logout", "User", userId?.ToString(), new { deviceName }, cancellationToken);
    }

    private async Task<AuthResponse> CreateAuthResponseAsync(
        UserEntity user,
        string deviceName,
        CancellationToken cancellationToken,
        string? replacedRefreshToken = null)
    {
        var (accessToken, _, accessExpiresAt) = jwtTokenService.GenerateAccessToken(user, deviceName);
        var (refreshToken, refreshExpiresAt) = jwtTokenService.GenerateRefreshToken();

        if (!string.IsNullOrWhiteSpace(replacedRefreshToken))
        {
            await authRepository.RevokeRefreshTokenAsync(replacedRefreshToken, DateTime.UtcNow, refreshToken, cancellationToken);
        }

        await authRepository.AddRefreshTokenAsync(
            new RefreshTokenEntity
            {
                UserId = user.Id,
                Token = refreshToken,
                DeviceName = deviceName,
                ExpiresAt = refreshExpiresAt,
                CreatedAt = DateTime.UtcNow
            },
            cancellationToken);

        return new AuthResponse(accessToken, refreshToken, user.ToDto(), accessExpiresAt, refreshExpiresAt);
    }

    private async Task WriteAuditAsync(int? userId, string action, string entityType, string? entityId, object details, CancellationToken cancellationToken)
    {
        await auditLogRepository.CreateAsync(
            new AuditLogEntity
            {
                UserId = userId,
                Action = action,
                EntityType = entityType,
                EntityId = entityId,
                DetailsJson = JsonSerializer.Serialize(details),
                Ip = currentUserService.IpAddress,
                CreatedAt = DateTime.UtcNow
            },
            cancellationToken);
    }

    private static string NormalizeDeviceName(string value) => value.Trim().ToUpperInvariant();
}

public sealed class ProjectService(
    IProjectRepository projectRepository,
    IUserRepository userRepository,
    IExecutiveUpdateRepository executiveUpdateRepository,
    INotificationRepository notificationRepository,
    IAuditLogRepository auditLogRepository,
    ICurrentUserService currentUserService,
    IMemoryCache memoryCache,
    IEncryptionService encryptionService,
    IHubContext<ProjectHub> hubContext) : IProjectService
{
    public async Task<PagedResult<ProjectListItemDto>> GetProjectsAsync(ProjectQueryParameters query, CancellationToken cancellationToken = default)
    {
        var scopedQuery = await ApplyVisibilityAsync(query, cancellationToken);
        var (items, totalCount) = await projectRepository.GetProjectsAsync(scopedQuery, cancellationToken);
        return new PagedResult<ProjectListItemDto>(items.Select(static item => item.ToListDto()).ToArray(), totalCount, scopedQuery.Page, scopedQuery.PageSize);
    }

    public async Task<ProjectDetailDto> GetProjectAsync(int id, CancellationToken cancellationToken = default)
    {
        await EnsureProjectAccessAsync(id, false, cancellationToken);
        var project = await projectRepository.GetProjectByIdAsync(id, cancellationToken)
            ?? throw new AppException("Project not found.", StatusCodes.Status404NotFound);
        var members = await projectRepository.GetProjectMembersAsync(id, cancellationToken);
        var updates = await executiveUpdateRepository.GetProjectUpdatesAsync(id, cancellationToken);
        return new ProjectDetailDto(project.ToListDto(), members.Select(static member => member.ToDto()).ToArray(), updates.Take(5).Select(static update => update.ToDto()).ToArray());
    }

    public async Task<ProjectDetailDto> CreateProjectAsync(CreateProjectRequest request, CancellationToken cancellationToken = default)
    {
        EnsureManagerRights();
        var now = DateTime.UtcNow;
        var startDate = request.StartDate == default ? now.Date : request.StartDate;
        var endDate = request.EndDate == default || request.EndDate < startDate
            ? startDate.AddDays(30)
            : request.EndDate;
        var projectManagerId = request.ProjectManagerId > 0
            ? request.ProjectManagerId
            : currentUserService.UserId ?? 1;
        var responsibleDepartmentId = request.ResponsibleDepartmentId > 0 ? request.ResponsibleDepartmentId : 1;
        var beneficiaryDepartmentId = request.BeneficiaryDepartmentId > 0 ? request.BeneficiaryDepartmentId : responsibleDepartmentId;
        var title = string.IsNullOrWhiteSpace(request.Title)
            ? $"مشروع جديد {now:yyyyMMddHHmmss}"
            : request.Title.Trim();
        var description = string.IsNullOrWhiteSpace(request.Description)
            ? "تم إنشاء هذا المشروع من لوحة التحكم."
            : request.Description.Trim();
        var documentNumber = string.IsNullOrWhiteSpace(request.DocumentNumber) ? null : request.DocumentNumber.Trim();
        var type = ValidationRuleSet.BeProjectType(request.Type) ? request.Type : "Software";
        var status = ValidationRuleSet.BeProjectStatus(request.Status) ? request.Status : "Planning";
        var priority = ValidationRuleSet.BePriority(request.Priority) ? request.Priority : "Medium";

        var projectId = await projectRepository.CreateProjectAsync(
            new ProjectEntity
            {
                Title = title,
                DocumentNumber = documentNumber,
                Description = description,
                Type = type,
                Status = status,
                Priority = priority,
                ProjectManagerId = projectManagerId,
                ResponsibleDepartmentId = responsibleDepartmentId,
                BeneficiaryDepartmentId = beneficiaryDepartmentId,
                Budget = Math.Max(0, request.Budget),
                ActualCost = Math.Max(0, request.ActualCost),
                StartDate = startDate,
                EndDate = endDate,
                CreatedAt = now,
                UpdatedAt = now
            },
            cancellationToken);

        await projectRepository.AddProjectMemberAsync(projectId, projectManagerId, SystemRoles.ProjectManager, cancellationToken);
        await WriteAuditAsync("ProjectCreated", "Project", projectId.ToString(), request, cancellationToken);
        InvalidateProjectCaches();
        return await GetProjectAsync(projectId, cancellationToken);
    }

    public async Task<ProjectDetailDto> UpdateProjectAsync(int id, UpdateProjectRequest request, CancellationToken cancellationToken = default)
    {
        await EnsureProjectAccessAsync(id, true, cancellationToken);

        var existing = await projectRepository.GetProjectByIdAsync(id, cancellationToken)
            ?? throw new AppException("Project not found.", StatusCodes.Status404NotFound);

        var updated = new ProjectEntity
        {
            Id = id,
            Title = request.Title.Trim(),
            DocumentNumber = string.IsNullOrWhiteSpace(request.DocumentNumber) ? null : request.DocumentNumber.Trim(),
            Description = request.Description.Trim(),
            Type = request.Type,
            Status = request.Status,
            Priority = request.Priority,
            ProjectManagerId = request.ProjectManagerId,
            ResponsibleDepartmentId = request.ResponsibleDepartmentId,
            BeneficiaryDepartmentId = request.BeneficiaryDepartmentId,
            Budget = request.Budget,
            ActualCost = request.ActualCost,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            UpdatedAt = DateTime.UtcNow
        };

        var updatedSuccessfully = await projectRepository.UpdateProjectAsync(updated, cancellationToken);
        if (!updatedSuccessfully)
        {
            throw new AppException("Project not found.", StatusCodes.Status404NotFound);
        }

        if (existing.ProjectManagerId != request.ProjectManagerId)
        {
            try
            {
                await projectRepository.AddProjectMemberAsync(id, request.ProjectManagerId, SystemRoles.ProjectManager, cancellationToken);
            }
            catch
            {
            }
        }

        await WriteAuditAsync("ProjectUpdated", "Project", id.ToString(), request, cancellationToken);
        InvalidateProjectCaches();
        return await GetProjectAsync(id, cancellationToken);
    }

    public async Task DeleteProjectAsync(int id, CancellationToken cancellationToken = default)
    {
        await EnsureProjectAccessAsync(id, true, cancellationToken);
        var deleted = await projectRepository.DeleteProjectAsync(id, cancellationToken);
        if (!deleted)
        {
            throw new AppException("Project not found.", StatusCodes.Status404NotFound);
        }

        await WriteAuditAsync("ProjectDeleted", "Project", id.ToString(), new { id }, cancellationToken);
        InvalidateProjectCaches();
    }

    public async Task<ProjectSummaryDto> GetSummaryAsync(int projectId, CancellationToken cancellationToken = default)
    {
        await EnsureProjectAccessAsync(projectId, false, cancellationToken);
        var (summary, updates) = await projectRepository.GetProjectSummaryAsync(projectId, cancellationToken);
        if (summary is null)
        {
            throw new AppException("Project not found.", StatusCodes.Status404NotFound);
        }

        return new ProjectSummaryDto(
            summary.ProjectId,
            summary.CompletionPercent,
            summary.TotalTasks,
            summary.DoneTasks,
            summary.InProgressTasks,
            summary.BlockedTasks,
            summary.Budget,
            summary.ActualCost,
            summary.Variance,
            summary.TeamSize,
            updates.Select(static update => update.ToDto()).ToArray());
    }

    public async Task<IReadOnlyCollection<ProjectTimelineItemDto>> GetTimelineAsync(TimelineQueryParameters query, CancellationToken cancellationToken = default)
    {
        var scopedQuery = await ApplyTimelineVisibilityAsync(query, cancellationToken);
        var items = await projectRepository.GetTimelineAsync(scopedQuery, cancellationToken);
        return items.Select(static item => item.ToTimelineDto()).ToArray();
    }

    public async Task<DashboardStatsDto> GetDashboardStatsAsync(CancellationToken cancellationToken = default)
    {
        if (memoryCache.TryGetValue(CacheKeys.DashboardStats, out DashboardStatsDto? cachedStats) && cachedStats is not null)
        {
            return cachedStats;
        }

        var stats = await projectRepository.GetDashboardStatsAsync(cancellationToken);
        var dto = new DashboardStatsDto(
            stats.ActiveProjects,
            stats.OverdueTasks,
            stats.ExpiredLicenses,
            stats.ProjectsByType.Select(static item => new ChartSliceDto(item.Label, item.Value, item.Color)).ToArray(),
            stats.ProjectsByStatus.Select(static item => new ChartSliceDto(item.Label, item.Value, item.Color)).ToArray(),
            stats.RecentUpdates.Select(static item => item.ToDto()).ToArray(),
            stats.ExpiringLicenses.Select(item =>
            {
                var plainKey = encryptionService.Decrypt(item.KeyValue);
                return item.ToDto(plainKey, encryptionService.Mask(plainKey));
            }).ToArray());

        memoryCache.Set(CacheKeys.DashboardStats, dto, TimeSpan.FromMinutes(2));
        return dto;
    }

    public async Task<IReadOnlyCollection<ProjectMemberDto>> GetProjectMembersAsync(int projectId, CancellationToken cancellationToken = default)
    {
        await EnsureProjectAccessAsync(projectId, false, cancellationToken);
        var members = await projectRepository.GetProjectMembersAsync(projectId, cancellationToken);
        return members.Select(static member => member.ToDto()).ToArray();
    }

    public async Task<ProjectMemberDto> AddProjectMemberAsync(int projectId, AddProjectMemberRequest request, CancellationToken cancellationToken = default)
    {
        await EnsureProjectAccessAsync(projectId, true, cancellationToken);
        var memberId = await projectRepository.AddProjectMemberAsync(projectId, request.UserId, request.RoleInProject.Trim(), cancellationToken);
        var members = await projectRepository.GetProjectMembersAsync(projectId, cancellationToken);
        var addedMember = members.Single(member => member.Id == memberId);

        await notificationRepository.CreateAsync(
            new NotificationEntity
            {
                UserId = request.UserId,
                Title = "Added to project",
                Message = $"You were added to project #{projectId}.",
                Type = "project:memberAdded",
                IsRead = false,
                RelatedEntityType = "Project",
                RelatedEntityId = projectId,
                CreatedAt = DateTime.UtcNow
            },
            cancellationToken);

        await hubContext.Clients.Group(HubGroups.Project(projectId)).SendAsync("project:memberAdded", new
        {
            projectId,
            member = addedMember.ToDto()
        }, cancellationToken);

        await WriteAuditAsync("ProjectMemberAdded", "ProjectMember", memberId.ToString(), request, cancellationToken);
        return addedMember.ToDto();
    }

    public async Task RemoveProjectMemberAsync(int projectId, int userId, CancellationToken cancellationToken = default)
    {
        await EnsureProjectAccessAsync(projectId, true, cancellationToken);
        var deleted = await projectRepository.RemoveProjectMemberAsync(projectId, userId, cancellationToken);
        if (!deleted)
        {
            throw new AppException("Project member not found.", StatusCodes.Status404NotFound);
        }

        await WriteAuditAsync("ProjectMemberRemoved", "ProjectMember", $"{projectId}:{userId}", new { projectId, userId }, cancellationToken);
    }

    public async Task<IReadOnlyCollection<ExecutiveUpdateDto>> GetProjectUpdatesAsync(int projectId, CancellationToken cancellationToken = default)
    {
        await EnsureProjectAccessAsync(projectId, false, cancellationToken);
        var updates = await executiveUpdateRepository.GetProjectUpdatesAsync(projectId, cancellationToken);
        return updates.Select(static update => update.ToDto()).ToArray();
    }

    public async Task<ExecutiveUpdateDto> AddProjectUpdateAsync(int projectId, CreateExecutiveUpdateRequest request, CancellationToken cancellationToken = default)
    {
        await EnsureProjectAccessAsync(projectId, true, cancellationToken);
        var createdBy = currentUserService.UserId ?? throw new AppException("Current user is missing.", StatusCodes.Status401Unauthorized);
        var updateId = await executiveUpdateRepository.CreateUpdateAsync(
            new ExecutiveUpdateEntity
            {
                ProjectId = projectId,
                Title = string.IsNullOrWhiteSpace(request.Title) ? null : request.Title.Trim(),
                Content = request.Content.Trim(),
                UpdateType = request.UpdateType,
                CreatedById = createdBy,
                CreatedAt = DateTime.UtcNow
            },
            cancellationToken);

        var update = (await executiveUpdateRepository.GetProjectUpdatesAsync(projectId, cancellationToken)).Single(item => item.Id == updateId);
        await hubContext.Clients.Group(HubGroups.Project(projectId)).SendAsync("project:updateAdded", update.ToDto(), cancellationToken);
        await WriteAuditAsync("ProjectUpdateAdded", "ExecutiveUpdate", updateId.ToString(), request, cancellationToken);
        InvalidateProjectCaches();
        return update.ToDto();
    }

    public async Task DeleteProjectUpdateAsync(int projectId, int updateId, CancellationToken cancellationToken = default)
    {
        await EnsureProjectAccessAsync(projectId, true, cancellationToken);

        var deleted = await executiveUpdateRepository.DeleteUpdateAsync(projectId, updateId, cancellationToken);
        if (!deleted)
        {
            throw new AppException("Executive update not found.", StatusCodes.Status404NotFound);
        }

        await hubContext.Clients.Group(HubGroups.Project(projectId)).SendAsync("project:updateDeleted", updateId, cancellationToken);
        await WriteAuditAsync("ProjectUpdateDeleted", "ExecutiveUpdate", updateId.ToString(), new { projectId, updateId }, cancellationToken);
        InvalidateProjectCaches();
    }

    private async Task<ProjectQueryParameters> ApplyVisibilityAsync(ProjectQueryParameters query, CancellationToken cancellationToken)
    {
        var userId = currentUserService.UserId;
        var role = currentUserService.Role;
        var departmentId = await GetCurrentUserDepartmentIdAsync(userId, cancellationToken);

        return role switch
        {
            SystemRoles.ProjectManager when userId.HasValue => query with { ProjectManagerId = userId.Value },
            SystemRoles.Member when userId.HasValue => query with { MemberUserId = userId.Value },
            SystemRoles.DepartmentDirector or SystemRoles.SectionHead or SystemRoles.DivisionSupervisor or SystemRoles.DivisionMember when departmentId.HasValue
                => query with { DepartmentId = departmentId.Value },
            _ => query
        };
    }

    private async Task<TimelineQueryParameters> ApplyTimelineVisibilityAsync(TimelineQueryParameters query, CancellationToken cancellationToken)
    {
        var userId = currentUserService.UserId;
        var role = currentUserService.Role;
        var departmentId = await GetCurrentUserDepartmentIdAsync(userId, cancellationToken);

        return role switch
        {
            SystemRoles.DepartmentDirector or SystemRoles.SectionHead or SystemRoles.DivisionSupervisor or SystemRoles.DivisionMember when departmentId.HasValue
                => query with { DepartmentId = departmentId.Value },
            _ => query
        };
    }

    private async Task<int?> GetCurrentUserDepartmentIdAsync(int? userId, CancellationToken cancellationToken)
    {
        if (userId is not > 0)
        {
            return null;
        }

        var user = await userRepository.GetByIdAsync(userId.Value, cancellationToken);
        return user?.DepartmentId;
    }

    private async Task EnsureProjectAccessAsync(int projectId, bool writeAccess, CancellationToken cancellationToken)
    {
        var userId = currentUserService.UserId ?? throw new AppException("Unauthorized.", StatusCodes.Status401Unauthorized);
        var role = currentUserService.Role ?? string.Empty;
        var hasAccess = await projectRepository.HasProjectAccessAsync(projectId, userId, role, writeAccess, cancellationToken);
        if (!hasAccess)
        {
            throw new AppException("You do not have permission to access this project.", StatusCodes.Status403Forbidden);
        }
    }

    private void EnsureManagerRights()
    {
        if (currentUserService.Role is not SystemRoles.Admin and not SystemRoles.ProjectManager)
        {
            throw new AppException("Only managers can perform this action.", StatusCodes.Status403Forbidden);
        }
    }

    private void InvalidateProjectCaches() => memoryCache.Remove(CacheKeys.DashboardStats);

    private async Task WriteAuditAsync(string action, string entityType, string? entityId, object details, CancellationToken cancellationToken)
    {
        await auditLogRepository.CreateAsync(
            new AuditLogEntity
            {
                UserId = currentUserService.UserId,
                Action = action,
                EntityType = entityType,
                EntityId = entityId,
                DetailsJson = JsonSerializer.Serialize(details),
                Ip = currentUserService.IpAddress,
                CreatedAt = DateTime.UtcNow
            },
            cancellationToken);
    }
}

public sealed class TaskService(
    ITaskRepository taskRepository,
    IProjectRepository projectRepository,
    IExecutiveUpdateRepository executiveUpdateRepository,
    INotificationRepository notificationRepository,
    IAuditLogRepository auditLogRepository,
    ICurrentUserService currentUserService,
    IMemoryCache memoryCache,
    IHubContext<ProjectHub> hubContext) : ITaskService
{
    public async Task<IReadOnlyCollection<TaskDto>> GetProjectTasksAsync(int projectId, CancellationToken cancellationToken = default)
    {
        await EnsureProjectAccessAsync(projectId, false, cancellationToken);
        var tasks = await taskRepository.GetProjectTasksAsync(projectId, cancellationToken);
        return tasks.Select(static task => task.ToDto()).ToArray();
    }

    public async Task<TaskDto> CreateTaskAsync(int projectId, CreateTaskRequest request, CancellationToken cancellationToken = default)
    {
        EnsureManagerRights();
        await EnsureProjectAccessAsync(projectId, true, cancellationToken);

        var createdBy = currentUserService.UserId ?? throw new AppException("Unauthorized.", StatusCodes.Status401Unauthorized);
        var assignedUserIds = ResolveAssignedUserIds(request.AssignedUserIds, request.AssignedToId);
        var taskId = await taskRepository.CreateTaskAsync(
            new ProjectTaskEntity
            {
                ProjectId = projectId,
                Title = request.Title.Trim(),
                Description = request.Description.Trim(),
                AssignedToId = GetPrimaryAssignedUserId(assignedUserIds),
                AssignedUserIds = assignedUserIds,
                CreatedById = createdBy,
                Status = request.Status,
                Priority = request.Priority,
                DueDate = request.DueDate,
                EstimatedHours = request.EstimatedHours,
                ActualHours = request.ActualHours,
                OrderIndex = request.OrderIndex,
                CreatedAt = DateTime.UtcNow
            },
            cancellationToken);

        var task = await taskRepository.GetTaskByIdAsync(taskId, cancellationToken)
            ?? throw new AppException("Task could not be loaded after creation.", StatusCodes.Status500InternalServerError);

        await NotifyAssignmentAsync(projectId, task, "task:assigned", cancellationToken);
        await WriteAuditAsync("TaskCreated", "Task", taskId.ToString(), request, cancellationToken);
        InvalidateCaches();
        return task.ToDto();
    }

    public async Task<TaskDto> UpdateTaskAsync(int id, UpdateTaskRequest request, CancellationToken cancellationToken = default)
    {
        var existing = await taskRepository.GetTaskByIdAsync(id, cancellationToken)
            ?? throw new AppException("Task not found.", StatusCodes.Status404NotFound);

        if (currentUserService.Role is SystemRoles.Member)
        {
            throw new AppException("Members can only update their assigned task status.", StatusCodes.Status403Forbidden);
        }

        await EnsureProjectAccessAsync(existing.ProjectId, true, cancellationToken);
        var assignedUserIds = ResolveAssignedUserIds(request.AssignedUserIds, request.AssignedToId);
        var updated = await taskRepository.UpdateTaskAsync(
            new ProjectTaskEntity
            {
                Id = id,
                ProjectId = existing.ProjectId,
                Title = request.Title.Trim(),
                Description = request.Description.Trim(),
                AssignedToId = GetPrimaryAssignedUserId(assignedUserIds),
                AssignedUserIds = assignedUserIds,
                CreatedById = existing.CreatedById,
                Status = request.Status,
                Priority = request.Priority,
                DueDate = request.DueDate,
                EstimatedHours = request.EstimatedHours,
                ActualHours = request.ActualHours,
                OrderIndex = request.OrderIndex,
                CreatedAt = existing.CreatedAt
            },
            cancellationToken);

        if (!updated)
        {
            throw new AppException("Task not found.", StatusCodes.Status404NotFound);
        }

        var task = await taskRepository.GetTaskByIdAsync(id, cancellationToken)
            ?? throw new AppException("Task not found.", StatusCodes.Status404NotFound);

        var existingAssigneeIds = existing.Assignees.Select(static assignee => assignee.UserId).ToHashSet();
        if (existingAssigneeIds.Count == 0 && existing.AssignedToId is int existingAssignedToId)
        {
            existingAssigneeIds.Add(existingAssignedToId);
        }

        var updatedAssigneeIds = task.Assignees.Select(static assignee => assignee.UserId).ToHashSet();
        if (updatedAssigneeIds.Count == 0 && task.AssignedToId is int updatedAssignedToId)
        {
            updatedAssigneeIds.Add(updatedAssignedToId);
        }

        if (!existingAssigneeIds.SetEquals(updatedAssigneeIds))
        {
            await NotifyAssignmentAsync(existing.ProjectId, task, "task:assigned", cancellationToken);
        }

        await WriteAuditAsync("TaskUpdated", "Task", id.ToString(), request, cancellationToken);
        InvalidateCaches();
        return task.ToDto();
    }

    public async Task<TaskDto> UpdateTaskStatusAsync(int id, UpdateTaskStatusRequest request, CancellationToken cancellationToken = default)
    {
        var task = await taskRepository.GetTaskByIdAsync(id, cancellationToken)
            ?? throw new AppException("Task not found.", StatusCodes.Status404NotFound);
        var shouldCreateCompletionUpdate = task.Status != "Done" && request.Status == "Done";

        await EnsureTaskStatusRightsAsync(task, cancellationToken);
        var updated = await taskRepository.UpdateTaskStatusAsync(id, request.Status, cancellationToken);
        if (!updated)
        {
            throw new AppException("Task not found.", StatusCodes.Status404NotFound);
        }

        var refreshedTask = await taskRepository.GetTaskByIdAsync(id, cancellationToken)
            ?? throw new AppException("Task not found.", StatusCodes.Status404NotFound);

        ExecutiveUpdateDto? completionUpdate = null;
        if (shouldCreateCompletionUpdate)
        {
            completionUpdate = await CreateCompletionExecutiveUpdateAsync(refreshedTask, cancellationToken);
        }

        await hubContext.Clients.Group(HubGroups.Project(task.ProjectId)).SendAsync("task:statusChanged", new
        {
            projectId = task.ProjectId,
            taskId = id,
            status = request.Status
        }, cancellationToken);

        if (completionUpdate is not null)
        {
            await hubContext.Clients.Group(HubGroups.Project(task.ProjectId)).SendAsync("project:updateAdded", completionUpdate, cancellationToken);
        }

        await WriteAuditAsync("TaskStatusChanged", "Task", id.ToString(), request, cancellationToken);
        InvalidateCaches();
        return refreshedTask.ToDto();
    }

    public async Task DeleteTaskAsync(int id, CancellationToken cancellationToken = default)
    {
        EnsureManagerRights();
        var task = await taskRepository.GetTaskByIdAsync(id, cancellationToken)
            ?? throw new AppException("Task not found.", StatusCodes.Status404NotFound);
        await EnsureProjectAccessAsync(task.ProjectId, true, cancellationToken);

        var deleted = await taskRepository.DeleteTaskAsync(id, cancellationToken);
        if (!deleted)
        {
            throw new AppException("Task not found.", StatusCodes.Status404NotFound);
        }

        await WriteAuditAsync("TaskDeleted", "Task", id.ToString(), new { id }, cancellationToken);
        InvalidateCaches();
    }

    private async Task EnsureProjectAccessAsync(int projectId, bool writeAccess, CancellationToken cancellationToken)
    {
        var userId = currentUserService.UserId ?? throw new AppException("Unauthorized.", StatusCodes.Status401Unauthorized);
        var role = currentUserService.Role ?? string.Empty;
        var hasAccess = await projectRepository.HasProjectAccessAsync(projectId, userId, role, writeAccess, cancellationToken);
        if (!hasAccess)
        {
            throw new AppException("You do not have permission to access this project.", StatusCodes.Status403Forbidden);
        }
    }

    private async Task EnsureTaskStatusRightsAsync(ProjectTaskEntity task, CancellationToken cancellationToken)
    {
        var role = currentUserService.Role;
        var userId = currentUserService.UserId ?? throw new AppException("Unauthorized.", StatusCodes.Status401Unauthorized);

        if (role == SystemRoles.Member)
        {
            var isAssigned = task.AssignedToId == userId || task.Assignees.Any(assignee => assignee.UserId == userId);
            if (!isAssigned)
            {
                throw new AppException("Members can only update their own assigned tasks.", StatusCodes.Status403Forbidden);
            }

            return;
        }

        await EnsureProjectAccessAsync(task.ProjectId, true, cancellationToken);
    }

    private void EnsureManagerRights()
    {
        if (currentUserService.Role is not SystemRoles.Admin and not SystemRoles.ProjectManager)
        {
            throw new AppException("Only managers can perform this action.", StatusCodes.Status403Forbidden);
        }
    }

    private async Task NotifyAssignmentAsync(int projectId, ProjectTaskEntity task, string eventName, CancellationToken cancellationToken)
    {
        var assignedUserIds = task.Assignees.Select(static assignee => assignee.UserId).ToArray();
        if (assignedUserIds.Length == 0 && task.AssignedToId is int assignedToId)
        {
            assignedUserIds = [assignedToId];
        }

        foreach (var assignedUserId in assignedUserIds.Distinct())
        {
            await notificationRepository.CreateAsync(
                new NotificationEntity
                {
                    UserId = assignedUserId,
                    Title = "Task assignment",
                    Message = $"Task '{task.Title}' has been assigned to you.",
                    Type = eventName,
                    IsRead = false,
                    RelatedEntityType = "Task",
                    RelatedEntityId = task.Id,
                    CreatedAt = DateTime.UtcNow
                },
                cancellationToken);
        }

        await hubContext.Clients.Group(HubGroups.Project(projectId)).SendAsync(eventName, task.ToDto(), cancellationToken);
    }

    private async Task<ExecutiveUpdateDto> CreateCompletionExecutiveUpdateAsync(ProjectTaskEntity task, CancellationToken cancellationToken)
    {
        var createdBy = currentUserService.UserId ?? throw new AppException("Unauthorized.", StatusCodes.Status401Unauthorized);
        var updateId = await executiveUpdateRepository.CreateUpdateAsync(
            new ExecutiveUpdateEntity
            {
                ProjectId = task.ProjectId,
                Title = task.Title.Trim(),
                Content = BuildCompletionExecutiveContent(task),
                UpdateType = "Achievement",
                CreatedById = createdBy,
                CreatedAt = DateTime.UtcNow
            },
            cancellationToken);

        var update = (await executiveUpdateRepository.GetProjectUpdatesAsync(task.ProjectId, cancellationToken))
            .Single(item => item.Id == updateId);

        await WriteAuditAsync(
            "ProjectUpdateAutoAdded",
            "ExecutiveUpdate",
            updateId.ToString(),
            new { taskId = task.Id, taskTitle = task.Title, source = "TaskCompleted" },
            cancellationToken);

        return update.ToDto();
    }

    private static string BuildCompletionExecutiveContent(ProjectTaskEntity task)
    {
        var description = task.Description.Trim();
        return string.IsNullOrWhiteSpace(description)
            ? $"تم إنجاز المهمة \"{task.Title.Trim()}\"."
            : description;
    }

    private static IReadOnlyCollection<int> ResolveAssignedUserIds(IReadOnlyCollection<int>? assignedUserIds, int? assignedToId)
    {
        var ids = assignedUserIds?.Where(static userId => userId > 0) ?? [];
        if (assignedToId is > 0)
        {
            ids = ids.Append(assignedToId.Value);
        }

        return ids.Distinct().ToArray();
    }

    private static int? GetPrimaryAssignedUserId(IReadOnlyCollection<int> assignedUserIds)
    {
        var primaryUserId = assignedUserIds.FirstOrDefault();
        return primaryUserId > 0 ? primaryUserId : null;
    }

    private void InvalidateCaches() => memoryCache.Remove(CacheKeys.DashboardStats);

    private async Task WriteAuditAsync(string action, string entityType, string? entityId, object details, CancellationToken cancellationToken)
    {
        await auditLogRepository.CreateAsync(
            new AuditLogEntity
            {
                UserId = currentUserService.UserId,
                Action = action,
                EntityType = entityType,
                EntityId = entityId,
                DetailsJson = JsonSerializer.Serialize(details),
                Ip = currentUserService.IpAddress,
                CreatedAt = DateTime.UtcNow
            },
            cancellationToken);
    }
}

public sealed class LicenseService(
    ILicenseRepository licenseRepository,
    INotificationRepository notificationRepository,
    IAuditLogRepository auditLogRepository,
    ICurrentUserService currentUserService,
    IEncryptionService encryptionService,
    IMemoryCache memoryCache,
    IHubContext<ProjectHub> hubContext) : ILicenseService
{
    public async Task<PagedResult<LicenseDto>> GetLicensesAsync(LicenseQueryParameters query, CancellationToken cancellationToken = default)
    {
        var (items, totalCount) = await licenseRepository.GetLicensesAsync(query, cancellationToken);
        return new PagedResult<LicenseDto>(items.Select(MapLicense).ToArray(), totalCount, query.Page, query.PageSize);
    }

    public async Task<IReadOnlyCollection<LicenseDto>> GetExpiringSoonAsync(int days, CancellationToken cancellationToken = default)
    {
        if (memoryCache.TryGetValue(CacheKeys.ExpiringLicenses, out IReadOnlyCollection<LicenseDto>? cachedLicenses) && cachedLicenses is not null)
        {
            return cachedLicenses;
        }

        var items = await licenseRepository.GetExpiringSoonAsync(days, cancellationToken);
        var dto = items.Select(MapLicense).ToArray();
        memoryCache.Set(CacheKeys.ExpiringLicenses, dto, TimeSpan.FromMinutes(5));
        return dto;
    }

    public async Task<LicenseDto> CreateAsync(CreateLicenseRequest request, CancellationToken cancellationToken = default)
    {
        EnsureManagerRights();
        var licenseId = await licenseRepository.CreateAsync(
            new LicenseEntity
            {
                Name = request.Name.Trim(),
                Type = request.Type,
                KeyValue = encryptionService.Encrypt(request.KeyValue.Trim()),
                Vendor = request.Vendor.Trim(),
                PurchaseDate = request.PurchaseDate,
                ExpiryDate = request.ExpiryDate,
                Cost = request.Cost,
                RenewalReminderDays = request.RenewalReminderDays,
                ProjectId = request.ProjectId,
                Notes = request.Notes.Trim(),
                Status = ResolveStatus(request.ExpiryDate, request.RenewalReminderDays)
            },
            cancellationToken);

        var license = await licenseRepository.GetByIdAsync(licenseId, cancellationToken)
            ?? throw new AppException("License could not be loaded after creation.", StatusCodes.Status500InternalServerError);

        await PublishExpiringEventAsync(license, cancellationToken);
        await WriteAuditAsync("LicenseCreated", "License", licenseId.ToString(), request, cancellationToken);
        InvalidateCaches();
        return MapLicense(license);
    }

    public async Task<LicenseDto> UpdateAsync(int id, UpdateLicenseRequest request, CancellationToken cancellationToken = default)
    {
        EnsureManagerRights();
        var existing = await licenseRepository.GetByIdAsync(id, cancellationToken)
            ?? throw new AppException("License not found.", StatusCodes.Status404NotFound);

        var encryptedKey = string.IsNullOrWhiteSpace(request.KeyValue)
            ? existing.KeyValue
            : encryptionService.Encrypt(request.KeyValue.Trim());

        var updated = await licenseRepository.UpdateAsync(
            new LicenseEntity
            {
                Id = id,
                Name = request.Name.Trim(),
                Type = request.Type,
                KeyValue = encryptedKey,
                Vendor = request.Vendor.Trim(),
                PurchaseDate = request.PurchaseDate,
                ExpiryDate = request.ExpiryDate,
                Cost = request.Cost,
                RenewalReminderDays = request.RenewalReminderDays,
                ProjectId = request.ProjectId,
                Notes = request.Notes.Trim(),
                Status = ResolveStatus(request.ExpiryDate, request.RenewalReminderDays)
            },
            cancellationToken);

        if (!updated)
        {
            throw new AppException("License not found.", StatusCodes.Status404NotFound);
        }

        var license = await licenseRepository.GetByIdAsync(id, cancellationToken)
            ?? throw new AppException("License not found.", StatusCodes.Status404NotFound);

        await PublishExpiringEventAsync(license, cancellationToken);
        await WriteAuditAsync("LicenseUpdated", "License", id.ToString(), request, cancellationToken);
        InvalidateCaches();
        return MapLicense(license);
    }

    public async Task DeleteAsync(int id, CancellationToken cancellationToken = default)
    {
        EnsureManagerRights();
        var deleted = await licenseRepository.DeleteAsync(id, cancellationToken);
        if (!deleted)
        {
            throw new AppException("License not found.", StatusCodes.Status404NotFound);
        }

        await WriteAuditAsync("LicenseDeleted", "License", id.ToString(), new { id }, cancellationToken);
        InvalidateCaches();
    }

    private LicenseDto MapLicense(LicenseEntity license)
    {
        var plainKey = encryptionService.Decrypt(license.KeyValue);
        return license.ToDto(plainKey, encryptionService.Mask(plainKey));
    }

    private async Task PublishExpiringEventAsync(LicenseEntity license, CancellationToken cancellationToken)
    {
        if (license.Status is not ("Expiring" or "Expired"))
        {
            return;
        }

        await notificationRepository.CreateAsync(
            new NotificationEntity
            {
                UserId = currentUserService.UserId ?? 1,
                Title = "License renewal reminder",
                Message = $"{license.Name} is {license.Status.ToLowerInvariant()}.",
                Type = "license:expiringSoon",
                IsRead = false,
                RelatedEntityType = "License",
                RelatedEntityId = license.Id,
                CreatedAt = DateTime.UtcNow
            },
            cancellationToken);

        await hubContext.Clients.All.SendAsync("license:expiringSoon", MapLicense(license), cancellationToken);
    }

    private static string ResolveStatus(DateTime expiryDate, int renewalReminderDays)
    {
        if (expiryDate <= DateTime.UtcNow)
        {
            return "Expired";
        }

        if (expiryDate <= DateTime.UtcNow.AddDays(renewalReminderDays))
        {
            return "Expiring";
        }

        return "Active";
    }

    private void EnsureManagerRights()
    {
        if (currentUserService.Role is not SystemRoles.Admin and not SystemRoles.ProjectManager)
        {
            throw new AppException("Only managers can perform this action.", StatusCodes.Status403Forbidden);
        }
    }

    private void InvalidateCaches()
    {
        memoryCache.Remove(CacheKeys.ExpiringLicenses);
        memoryCache.Remove(CacheKeys.DashboardStats);
    }

    private async Task WriteAuditAsync(string action, string entityType, string? entityId, object details, CancellationToken cancellationToken)
    {
        await auditLogRepository.CreateAsync(
            new AuditLogEntity
            {
                UserId = currentUserService.UserId,
                Action = action,
                EntityType = entityType,
                EntityId = entityId,
                DetailsJson = JsonSerializer.Serialize(details),
                Ip = currentUserService.IpAddress,
                CreatedAt = DateTime.UtcNow
            },
            cancellationToken);
    }
}

public sealed class NotificationService(
    INotificationRepository notificationRepository,
    ICurrentUserService currentUserService,
    IAuditLogRepository auditLogRepository) : INotificationService
{
    public async Task<PagedResult<NotificationDto>> GetNotificationsAsync(NotificationQueryParameters query, CancellationToken cancellationToken = default)
    {
        var userId = currentUserService.UserId ?? throw new AppException("Unauthorized.", StatusCodes.Status401Unauthorized);
        var (items, totalCount) = await notificationRepository.GetNotificationsAsync(userId, query, cancellationToken);
        return new PagedResult<NotificationDto>(items.Select(static notification => notification.ToDto()).ToArray(), totalCount, query.Page, query.PageSize);
    }

    public async Task<int> MarkReadAsync(MarkNotificationsReadRequest request, CancellationToken cancellationToken = default)
    {
        var userId = currentUserService.UserId ?? throw new AppException("Unauthorized.", StatusCodes.Status401Unauthorized);
        var affectedRows = await notificationRepository.MarkReadAsync(userId, request.NotificationIds, cancellationToken);
        await auditLogRepository.CreateAsync(
            new AuditLogEntity
            {
                UserId = userId,
                Action = "NotificationsMarkedRead",
                EntityType = "Notification",
                EntityId = null,
                DetailsJson = JsonSerializer.Serialize(new { request.NotificationIds }),
                Ip = currentUserService.IpAddress,
                CreatedAt = DateTime.UtcNow
            },
            cancellationToken);
        return affectedRows;
    }
}

public sealed class UserService(
    IUserRepository userRepository,
    IDepartmentRepository departmentRepository,
    IPasswordHasher passwordHasher,
    IAuditLogRepository auditLogRepository,
    ICurrentUserService currentUserService,
    IMemoryCache memoryCache) : IUserService
{
    public async Task<PagedResult<UserDto>> GetUsersAsync(UserQueryParameters query, CancellationToken cancellationToken = default)
    {
        var cacheVersion = memoryCache.Get<string>(CacheKeys.UsersVersion) ?? "base";
        var cacheKey = $"{CacheKeys.Users}:{cacheVersion}:{query.Page}:{query.PageSize}:{query.Search}:{query.DepartmentId}:{query.Role}:{currentUserService.Role}";
        if (memoryCache.TryGetValue(cacheKey, out PagedResult<UserDto>? cachedUsers) && cachedUsers is not null)
        {
            return cachedUsers;
        }

        var (items, totalCount) = await userRepository.GetUsersAsync(query, cancellationToken);
        var dto = new PagedResult<UserDto>(items.Select(static user => user.ToDto()).ToArray(), totalCount, query.Page, query.PageSize);
        memoryCache.Set(cacheKey, dto, TimeSpan.FromMinutes(5));
        return dto;
    }

    public async Task<UserDto> CreateUserAsync(CreateUserRequest request, CancellationToken cancellationToken = default)
    {
        EnsureAdminRights();
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var existingUser = await userRepository.GetByEmailAsync(normalizedEmail, cancellationToken);
        if (existingUser is not null)
        {
            throw new AppException("A user with this email already exists.", StatusCodes.Status409Conflict);
        }

        var departmentId = await ResolveDepartmentIdAsync(request.DepartmentId, cancellationToken);
        var createdId = await userRepository.CreateAsync(
            new UserEntity
            {
                Name = request.Name.Trim(),
                Email = normalizedEmail,
                PasswordHash = passwordHasher.Hash(request.Password),
                Role = request.Role.Trim(),
                Avatar = string.IsNullOrWhiteSpace(request.Avatar) ? null : request.Avatar.Trim(),
                DepartmentId = departmentId,
                CreatedAt = DateTime.UtcNow
            },
            cancellationToken);

        var user = await userRepository.GetByIdAsync(createdId, cancellationToken)
            ?? throw new AppException("User could not be loaded after creation.", StatusCodes.Status500InternalServerError);

        await WriteAuditAsync("UserCreated", createdId.ToString(), request, cancellationToken);
        InvalidateCaches();
        return user.ToDto();
    }

    public async Task<UserDto> UpdateUserAsync(int id, UpdateUserRequest request, CancellationToken cancellationToken = default)
    {
        EnsureAdminRights();
        var existingUser = await userRepository.GetByIdAsync(id, cancellationToken)
            ?? throw new AppException("User not found.", StatusCodes.Status404NotFound);

        var departmentId = await ResolveDepartmentIdAsync(request.DepartmentId, cancellationToken);
        var updated = await userRepository.UpdateAsync(
            new UserEntity
            {
                Id = id,
                Name = request.Name.Trim(),
                Email = existingUser.Email,
                PasswordHash = existingUser.PasswordHash,
                Role = request.Role.Trim(),
                Avatar = string.IsNullOrWhiteSpace(request.Avatar) ? null : request.Avatar.Trim(),
                DepartmentId = departmentId,
                CreatedAt = existingUser.CreatedAt
            },
            cancellationToken);

        if (!updated)
        {
            throw new AppException("User not found.", StatusCodes.Status404NotFound);
        }

        var user = await userRepository.GetByIdAsync(id, cancellationToken)
            ?? throw new AppException("User not found.", StatusCodes.Status404NotFound);

        await WriteAuditAsync("UserUpdated", id.ToString(), request, cancellationToken);
        InvalidateCaches();
        return user.ToDto();
    }

    private async Task<int?> ResolveDepartmentIdAsync(int? departmentId, CancellationToken cancellationToken)
    {
        if (departmentId is not > 0)
        {
            return null;
        }

        var department = await departmentRepository.GetByIdAsync(departmentId.Value, cancellationToken);
        if (department is null)
        {
            throw new AppException("Department not found.", StatusCodes.Status404NotFound);
        }

        return department.Id;
    }

    private void EnsureAdminRights()
    {
        if (currentUserService.Role != SystemRoles.Admin)
        {
            throw new AppException("Only system administrators can manage users.", StatusCodes.Status403Forbidden);
        }
    }

    private void InvalidateCaches() => memoryCache.Set(CacheKeys.UsersVersion, Guid.NewGuid().ToString("N"));

    private async Task WriteAuditAsync(string action, string entityId, object details, CancellationToken cancellationToken)
    {
        await auditLogRepository.CreateAsync(
            new AuditLogEntity
            {
                UserId = currentUserService.UserId,
                Action = action,
                EntityType = "User",
                EntityId = entityId,
                DetailsJson = JsonSerializer.Serialize(details),
                Ip = currentUserService.IpAddress,
                CreatedAt = DateTime.UtcNow
            },
            cancellationToken);
    }
}

public sealed class DepartmentService(
    IDepartmentRepository departmentRepository,
    IAuditLogRepository auditLogRepository,
    ICurrentUserService currentUserService) : IDepartmentService
{
    public async Task<IReadOnlyCollection<DepartmentDto>> GetDepartmentsAsync(CancellationToken cancellationToken = default)
    {
        var departments = await departmentRepository.GetDepartmentsAsync(cancellationToken);
        return departments.Select(static department => department.ToDto()).ToArray();
    }

    public async Task<DepartmentDto> CreateDepartmentAsync(CreateDepartmentRequest request, CancellationToken cancellationToken = default)
    {
        EnsureAdminRights();
        var createdId = await departmentRepository.CreateAsync(
            new DepartmentEntity
            {
                Name = request.Name.Trim(),
                Type = request.Type.Trim(),
                Color = request.Color.Trim(),
                Icon = request.Icon.Trim()
            },
            cancellationToken);

        var department = await departmentRepository.GetByIdAsync(createdId, cancellationToken)
            ?? throw new AppException("Department could not be loaded after creation.", StatusCodes.Status500InternalServerError);

        await auditLogRepository.CreateAsync(
            new AuditLogEntity
            {
                UserId = currentUserService.UserId,
                Action = "DepartmentCreated",
                EntityType = "Department",
                EntityId = createdId.ToString(),
                DetailsJson = JsonSerializer.Serialize(request),
                Ip = currentUserService.IpAddress,
                CreatedAt = DateTime.UtcNow
            },
            cancellationToken);

        return department.ToDto();
    }

    private void EnsureAdminRights()
    {
        if (currentUserService.Role != SystemRoles.Admin)
        {
            throw new AppException("Only system administrators can manage departments.", StatusCodes.Status403Forbidden);
        }
    }
}

public sealed class DeviceAdminService(
    IDeviceRepository deviceRepository,
    IAuthRepository authRepository,
    IAuditLogRepository auditLogRepository,
    ICurrentUserService currentUserService) : IDeviceAdminService
{
    public async Task<PagedResult<RegisteredDeviceDto>> GetDevicesAsync(DeviceQueryParameters query, CancellationToken cancellationToken = default)
    {
        EnsureAdminRights();
        var (items, totalCount) = await deviceRepository.GetDevicesAsync(query, cancellationToken);
        return new PagedResult<RegisteredDeviceDto>(items.Select(static device => device.ToDto()).ToArray(), totalCount, query.Page, query.PageSize);
    }

    public async Task<RegisteredDeviceDto> RegisterAsync(RegisterDeviceRequest request, CancellationToken cancellationToken = default)
    {
        EnsureAdminRights();
        var createdId = await deviceRepository.CreateAsync(
            new RegisteredDeviceEntity
            {
                DeviceName = request.DeviceName.Trim().ToUpperInvariant(),
                UserId = request.UserId,
                IsActive = true,
                RegisteredAt = DateTime.UtcNow,
                RegisteredBy = currentUserService.UserId ?? throw new AppException("Unauthorized.", StatusCodes.Status401Unauthorized),
                Notes = request.Notes?.Trim()
            },
            cancellationToken);

        var device = await deviceRepository.GetByIdAsync(createdId, cancellationToken)
            ?? throw new AppException("Device could not be loaded after creation.", StatusCodes.Status500InternalServerError);

        await WriteAuditAsync("DeviceRegistered", "RegisteredDevice", createdId.ToString(), request, cancellationToken);
        return device.ToDto();
    }

    public async Task<RegisteredDeviceDto> ToggleAsync(int id, ToggleDeviceRequest request, CancellationToken cancellationToken = default)
    {
        EnsureAdminRights();
        var toggled = await deviceRepository.ToggleAsync(id, request.IsActive, cancellationToken);
        if (!toggled)
        {
            throw new AppException("Device not found.", StatusCodes.Status404NotFound);
        }

        var device = await deviceRepository.GetByIdAsync(id, cancellationToken)
            ?? throw new AppException("Device not found.", StatusCodes.Status404NotFound);

        if (!request.IsActive)
        {
            await authRepository.RevokeRefreshTokensForDeviceAsync(device.DeviceName, cancellationToken);
        }

        await WriteAuditAsync("DeviceToggled", "RegisteredDevice", id.ToString(), request, cancellationToken);
        return device.ToDto();
    }

    public async Task DeleteAsync(int id, CancellationToken cancellationToken = default)
    {
        EnsureAdminRights();
        var device = await deviceRepository.GetByIdAsync(id, cancellationToken)
            ?? throw new AppException("Device not found.", StatusCodes.Status404NotFound);

        await authRepository.RevokeRefreshTokensForDeviceAsync(device.DeviceName, cancellationToken);
        var deleted = await deviceRepository.DeleteAsync(id, cancellationToken);
        if (!deleted)
        {
            throw new AppException("Device not found.", StatusCodes.Status404NotFound);
        }

        await WriteAuditAsync("DeviceDeleted", "RegisteredDevice", id.ToString(), new { id }, cancellationToken);
    }

    private void EnsureAdminRights()
    {
        if (currentUserService.Role != SystemRoles.Admin)
        {
            throw new AppException("Only administrators can perform this action.", StatusCodes.Status403Forbidden);
        }
    }

    private async Task WriteAuditAsync(string action, string entityType, string? entityId, object details, CancellationToken cancellationToken)
    {
        await auditLogRepository.CreateAsync(
            new AuditLogEntity
            {
                UserId = currentUserService.UserId,
                Action = action,
                EntityType = entityType,
                EntityId = entityId,
                DetailsJson = JsonSerializer.Serialize(details),
                Ip = currentUserService.IpAddress,
                CreatedAt = DateTime.UtcNow
            },
            cancellationToken);
    }
}

internal static class ServiceMappings
{
    private static string? NormalizeDisplayName(string? name, string? email = null)
    {
        if (!string.IsNullOrWhiteSpace(email))
        {
            return email.Trim().ToLowerInvariant() switch
            {
                "fatma@techflow.local" => "طلال الراشدي",
                "saeed@techflow.local" => "سعيد السلامي",
                "aisha@techflow.local" => "محمد النعماني",
                "mohammed@techflow.local" => "خالد البوسعيدي",
                "nasser@techflow.local" => "ناصر الشهري",
                "faisal@techflow.local" => "فيصل العتيبي",
                "majed@techflow.local" => "ماجد السهلي",
                _ => name
            };
        }

        return name switch
        {
            "Fatma Al-Harthi" => "طلال الراشدي",
            "خالد الحارثي" => "طلال الراشدي",
            "Saeed Al-Balushi" => "سعيد السلامي",
            "سعيد البلوشي" => "سعيد السلامي",
            "Aisha Al-Rawahi" => "محمد النعماني",
            "عبدالله الرواحي" => "محمد النعماني",
            "Mohammed Al-Qahtani" => "خالد البوسعيدي",
            "محمد القحطاني" => "خالد البوسعيدي",
            _ => name
        };
    }

    public static UserDto ToDto(this UserEntity entity)
        => new(entity.Id, NormalizeDisplayName(entity.Name, entity.Email) ?? entity.Name, entity.Email, entity.Role, entity.Avatar, entity.DepartmentId, entity.DepartmentName, entity.DepartmentType, entity.CreatedAt);

    public static DepartmentDto ToDto(this DepartmentEntity entity)
        => new(entity.Id, entity.Name, entity.Type, entity.Color, entity.Icon);

    public static ProjectMemberDto ToDto(this ProjectMemberEntity entity)
        => new(entity.Id, entity.ProjectId, entity.UserId, entity.RoleInProject, entity.JoinedAt, NormalizeDisplayName(entity.UserName, entity.UserEmail) ?? entity.UserName, entity.UserEmail, entity.UserAvatar);

    public static TaskDto ToDto(this ProjectTaskEntity entity)
        => new(
            entity.Id,
            entity.ProjectId,
            entity.Title,
            entity.Description,
            entity.AssignedToId,
            NormalizeDisplayName(entity.AssignedToName),
            entity.Assignees.Select(static assignee => new TaskAssigneeDto(assignee.UserId, NormalizeDisplayName(assignee.UserName, assignee.UserEmail) ?? assignee.UserName, assignee.UserEmail, assignee.UserAvatar)).ToArray(),
            entity.CreatedById,
            NormalizeDisplayName(entity.CreatedByName),
            entity.Status,
            entity.Priority,
            entity.DueDate,
            entity.EstimatedHours,
            entity.ActualHours,
            entity.OrderIndex,
            entity.CreatedAt);

    public static ExecutiveUpdateDto ToDto(this ExecutiveUpdateEntity entity)
        => new(entity.Id, entity.ProjectId, entity.Title, entity.Content, entity.UpdateType, entity.CreatedById, NormalizeDisplayName(entity.CreatedByName), entity.CreatedAt);

    public static NotificationDto ToDto(this NotificationEntity entity)
        => new(entity.Id, entity.Title, entity.Message, entity.Type, entity.IsRead, entity.RelatedEntityType, entity.RelatedEntityId, entity.CreatedAt);

    public static RegisteredDeviceDto ToDto(this RegisteredDeviceEntity entity)
        => new(entity.Id, entity.DeviceName, entity.UserId, NormalizeDisplayName(entity.UserName, entity.UserEmail), entity.UserEmail, entity.IsActive, entity.LastLogin, entity.RegisteredAt, entity.RegisteredBy, NormalizeDisplayName(entity.RegisteredByName), entity.Notes);

    public static ProjectListItemDto ToListDto(this ProjectEntity entity)
    {
        var progress = entity.TotalTasks == 0 ? 0 : Math.Round(entity.CompletedTasks * 100m / entity.TotalTasks, 2);
        return new ProjectListItemDto(
            entity.Id,
            entity.Title,
            entity.DocumentNumber,
            entity.Description,
            entity.Type,
            entity.Status,
            entity.Priority,
            entity.ProjectManagerId,
            NormalizeDisplayName(entity.ProjectManagerName),
            entity.ResponsibleDepartmentId,
            entity.ResponsibleDepartmentName,
            entity.ResponsibleDepartmentColor,
            entity.BeneficiaryDepartmentId,
            entity.BeneficiaryDepartmentName,
            entity.Budget,
            entity.ActualCost,
            entity.StartDate,
            entity.EndDate,
            entity.CreatedAt,
            entity.UpdatedAt,
            entity.TotalTasks,
            entity.CompletedTasks,
            entity.BlockedTasks,
            entity.TeamSize,
            progress);
    }

    public static ProjectTimelineItemDto ToTimelineDto(this ProjectEntity entity)
        => new(entity.Id, entity.Title, entity.Type, entity.Status, entity.StartDate, entity.EndDate, entity.ResponsibleDepartmentName, entity.ResponsibleDepartmentColor, entity.TotalTasks == 0 ? 0 : Math.Round(entity.CompletedTasks * 100m / entity.TotalTasks, 2));

    public static LicenseDto ToDto(this LicenseEntity entity, string plainKey, string maskedKey)
        => new(
            entity.Id,
            entity.Name,
            entity.Type,
            plainKey,
            maskedKey,
            entity.Vendor,
            entity.PurchaseDate,
            entity.ExpiryDate,
            entity.Cost,
            entity.RenewalReminderDays,
            entity.ProjectId,
            entity.ProjectTitle,
            entity.Notes,
            entity.Status,
            entity.DaysUntilExpiry);
}
