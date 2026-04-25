using TechFlowPM.API.DTOs;
using TechFlowPM.API.Models;

namespace TechFlowPM.API.Repositories;

public interface IUserRepository
{
    Task<UserEntity?> GetByIdAsync(int id, CancellationToken cancellationToken = default);
    Task<UserEntity?> GetByEmailAsync(string email, CancellationToken cancellationToken = default);
    Task<(IReadOnlyCollection<UserEntity> Items, int TotalCount)> GetUsersAsync(UserQueryParameters query, CancellationToken cancellationToken = default);
}

public interface IProjectRepository
{
    Task<(IReadOnlyCollection<ProjectEntity> Items, int TotalCount)> GetProjectsAsync(ProjectQueryParameters query, CancellationToken cancellationToken = default);
    Task<ProjectEntity?> GetProjectByIdAsync(int id, CancellationToken cancellationToken = default);
    Task<int> CreateProjectAsync(ProjectEntity project, CancellationToken cancellationToken = default);
    Task<bool> UpdateProjectAsync(ProjectEntity project, CancellationToken cancellationToken = default);
    Task<bool> DeleteProjectAsync(int id, CancellationToken cancellationToken = default);
    Task<IReadOnlyCollection<ProjectMemberEntity>> GetProjectMembersAsync(int projectId, CancellationToken cancellationToken = default);
    Task<int> AddProjectMemberAsync(int projectId, int userId, string roleInProject, CancellationToken cancellationToken = default);
    Task<bool> RemoveProjectMemberAsync(int projectId, int userId, CancellationToken cancellationToken = default);
    Task<(ProjectSummaryEntity? Summary, IReadOnlyCollection<ExecutiveUpdateEntity> Updates)> GetProjectSummaryAsync(int projectId, CancellationToken cancellationToken = default);
    Task<IReadOnlyCollection<ProjectEntity>> GetTimelineAsync(TimelineQueryParameters query, CancellationToken cancellationToken = default);
    Task<DashboardStatsEntity> GetDashboardStatsAsync(CancellationToken cancellationToken = default);
    Task<bool> HasProjectAccessAsync(int projectId, int userId, string role, bool writeAccess, CancellationToken cancellationToken = default);
}

public interface ITaskRepository
{
    Task<IReadOnlyCollection<ProjectTaskEntity>> GetProjectTasksAsync(int projectId, CancellationToken cancellationToken = default);
    Task<ProjectTaskEntity?> GetTaskByIdAsync(int id, CancellationToken cancellationToken = default);
    Task<int> CreateTaskAsync(ProjectTaskEntity task, CancellationToken cancellationToken = default);
    Task<bool> UpdateTaskAsync(ProjectTaskEntity task, CancellationToken cancellationToken = default);
    Task<bool> UpdateTaskStatusAsync(int id, string status, CancellationToken cancellationToken = default);
    Task<bool> DeleteTaskAsync(int id, CancellationToken cancellationToken = default);
}

public interface IExecutiveUpdateRepository
{
    Task<IReadOnlyCollection<ExecutiveUpdateEntity>> GetProjectUpdatesAsync(int projectId, CancellationToken cancellationToken = default);
    Task<IReadOnlyCollection<ExecutiveUpdateEntity>> GetRecentUpdatesAsync(int take = 10, CancellationToken cancellationToken = default);
    Task<int> CreateUpdateAsync(ExecutiveUpdateEntity update, CancellationToken cancellationToken = default);
    Task<bool> DeleteUpdateAsync(int projectId, int updateId, CancellationToken cancellationToken = default);
}

public interface ILicenseRepository
{
    Task<(IReadOnlyCollection<LicenseEntity> Items, int TotalCount)> GetLicensesAsync(LicenseQueryParameters query, CancellationToken cancellationToken = default);
    Task<IReadOnlyCollection<LicenseEntity>> GetExpiringSoonAsync(int days, CancellationToken cancellationToken = default);
    Task<LicenseEntity?> GetByIdAsync(int id, CancellationToken cancellationToken = default);
    Task<int> CreateAsync(LicenseEntity license, CancellationToken cancellationToken = default);
    Task<bool> UpdateAsync(LicenseEntity license, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(int id, CancellationToken cancellationToken = default);
}

public interface INotificationRepository
{
    Task<(IReadOnlyCollection<NotificationEntity> Items, int TotalCount)> GetNotificationsAsync(int userId, NotificationQueryParameters query, CancellationToken cancellationToken = default);
    Task<int> CreateAsync(NotificationEntity notification, CancellationToken cancellationToken = default);
    Task<int> MarkReadAsync(int userId, IReadOnlyCollection<int>? notificationIds, CancellationToken cancellationToken = default);
}

public interface IAuthRepository
{
    Task<RegisteredDeviceEntity?> GetDeviceByNameAsync(string deviceName, CancellationToken cancellationToken = default);
    Task UpdateLastLoginAsync(int deviceId, DateTime lastLoginUtc, CancellationToken cancellationToken = default);
    Task AddRefreshTokenAsync(RefreshTokenEntity refreshToken, CancellationToken cancellationToken = default);
    Task<RefreshTokenEntity?> GetRefreshTokenAsync(string token, CancellationToken cancellationToken = default);
    Task RevokeRefreshTokenAsync(string token, DateTime revokedAtUtc, string? replacedByToken, CancellationToken cancellationToken = default);
    Task RevokeRefreshTokensForDeviceAsync(string deviceName, CancellationToken cancellationToken = default);
    Task RevokeAccessTokenAsync(RevokedTokenEntity revokedToken, CancellationToken cancellationToken = default);
    Task<bool> IsTokenRevokedAsync(string jti, CancellationToken cancellationToken = default);
    Task<bool> IsDeviceAuthorizedAsync(string deviceName, int userId, CancellationToken cancellationToken = default);
}

public interface IDeviceRepository
{
    Task<(IReadOnlyCollection<RegisteredDeviceEntity> Items, int TotalCount)> GetDevicesAsync(DeviceQueryParameters query, CancellationToken cancellationToken = default);
    Task<RegisteredDeviceEntity?> GetByIdAsync(int id, CancellationToken cancellationToken = default);
    Task<int> CreateAsync(RegisteredDeviceEntity device, CancellationToken cancellationToken = default);
    Task<bool> ToggleAsync(int id, bool isActive, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(int id, CancellationToken cancellationToken = default);
}

public interface IAuditLogRepository
{
    Task<int> CreateAsync(AuditLogEntity auditLog, CancellationToken cancellationToken = default);
}

public sealed class ProjectSummaryEntity
{
    public int ProjectId { get; set; }
    public decimal CompletionPercent { get; set; }
    public int TotalTasks { get; set; }
    public int DoneTasks { get; set; }
    public int InProgressTasks { get; set; }
    public int BlockedTasks { get; set; }
    public decimal Budget { get; set; }
    public decimal ActualCost { get; set; }
    public decimal Variance { get; set; }
    public int TeamSize { get; set; }
}
