namespace TechFlowPM.API.Models;

public static class SystemRoles
{
    public const string Admin = "Admin";
    public const string ProjectManager = "Project Manager";
    public const string Member = "Member";
    public const string Viewer = "Viewer";

    public static readonly string[] All = [Admin, ProjectManager, Member, Viewer];
}

public static class DomainLookups
{
    public static readonly string[] DepartmentTypes = ["Software", "Networks", "Security", "Maintenance"];
    public static readonly string[] ProjectTypes = ["Software", "Networks", "Cybersecurity", "Maintenance"];
    public static readonly string[] ProjectStatuses = ["Planning", "Active", "OnHold", "Completed", "Cancelled"];
    public static readonly string[] Priorities = ["Low", "Medium", "High", "Critical"];
    public static readonly string[] TaskStatuses = ["Todo", "InProgress", "Review", "Done", "Blocked"];
    public static readonly string[] UpdateTypes = ["StatusUpdate", "Milestone", "Issue", "Achievement"];
    public static readonly string[] LicenseTypes = ["OS", "Software", "Certificate", "Domain", "Other"];
    public static readonly string[] LicenseStatuses = ["Active", "Expired", "Expiring"];
}

public sealed class UserEntity
{
    public int Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public string PasswordHash { get; init; } = string.Empty;
    public string Role { get; init; } = string.Empty;
    public string? Avatar { get; init; }
    public int? DepartmentId { get; init; }
    public string? DepartmentName { get; init; }
    public string? DepartmentType { get; init; }
    public DateTime CreatedAt { get; init; }
}

public sealed class DepartmentEntity
{
    public int Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Type { get; init; } = string.Empty;
    public string Color { get; init; } = string.Empty;
    public string Icon { get; init; } = string.Empty;
}

public sealed class ProjectEntity
{
    public int Id { get; init; }
    public string Title { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public string Type { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public string Priority { get; init; } = string.Empty;
    public int ProjectManagerId { get; init; }
    public string? ProjectManagerName { get; init; }
    public int ResponsibleDepartmentId { get; init; }
    public string? ResponsibleDepartmentName { get; init; }
    public string? ResponsibleDepartmentColor { get; init; }
    public int BeneficiaryDepartmentId { get; init; }
    public string? BeneficiaryDepartmentName { get; init; }
    public decimal Budget { get; init; }
    public decimal ActualCost { get; init; }
    public DateTime StartDate { get; init; }
    public DateTime EndDate { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
    public int TotalTasks { get; init; }
    public int CompletedTasks { get; init; }
    public int BlockedTasks { get; init; }
    public int TeamSize { get; init; }
}

public sealed class ProjectMemberEntity
{
    public int Id { get; init; }
    public int ProjectId { get; init; }
    public int UserId { get; init; }
    public string RoleInProject { get; init; } = string.Empty;
    public DateTime JoinedAt { get; init; }
    public string UserName { get; init; } = string.Empty;
    public string? UserEmail { get; init; }
    public string? UserAvatar { get; init; }
}

public sealed class ProjectTaskEntity
{
    public int Id { get; init; }
    public int ProjectId { get; init; }
    public string Title { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public int? AssignedToId { get; init; }
    public string? AssignedToName { get; init; }
    public int CreatedById { get; init; }
    public string? CreatedByName { get; init; }
    public string Status { get; init; } = string.Empty;
    public string Priority { get; init; } = string.Empty;
    public DateTime? DueDate { get; init; }
    public decimal EstimatedHours { get; init; }
    public decimal ActualHours { get; init; }
    public int OrderIndex { get; init; }
    public DateTime CreatedAt { get; init; }
    public IReadOnlyCollection<int> AssignedUserIds { get; init; } = [];
    public IReadOnlyCollection<TaskAssigneeEntity> Assignees { get; set; } = [];
}

public sealed class TaskAssigneeEntity
{
    public int TaskId { get; init; }
    public int UserId { get; init; }
    public string UserName { get; init; } = string.Empty;
    public string? UserEmail { get; init; }
    public string? UserAvatar { get; init; }
}

public sealed class ExecutiveUpdateEntity
{
    public int Id { get; init; }
    public int ProjectId { get; init; }
    public string Content { get; init; } = string.Empty;
    public string UpdateType { get; init; } = string.Empty;
    public int CreatedById { get; init; }
    public string? CreatedByName { get; init; }
    public DateTime CreatedAt { get; init; }
}

public sealed class LicenseEntity
{
    public int Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Type { get; init; } = string.Empty;
    public string KeyValue { get; init; } = string.Empty;
    public string Vendor { get; init; } = string.Empty;
    public DateTime PurchaseDate { get; init; }
    public DateTime ExpiryDate { get; init; }
    public decimal Cost { get; init; }
    public int RenewalReminderDays { get; init; }
    public int? ProjectId { get; init; }
    public string? ProjectTitle { get; init; }
    public string Notes { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public int DaysUntilExpiry { get; init; }
}

public sealed class NotificationEntity
{
    public int Id { get; init; }
    public int UserId { get; init; }
    public string Title { get; init; } = string.Empty;
    public string Message { get; init; } = string.Empty;
    public string Type { get; init; } = string.Empty;
    public bool IsRead { get; init; }
    public string? RelatedEntityType { get; init; }
    public int? RelatedEntityId { get; init; }
    public DateTime CreatedAt { get; init; }
}

public sealed class AuditLogEntity
{
    public int Id { get; init; }
    public int? UserId { get; init; }
    public string Action { get; init; } = string.Empty;
    public string EntityType { get; init; } = string.Empty;
    public string? EntityId { get; init; }
    public string DetailsJson { get; init; } = "{}";
    public string? Ip { get; init; }
    public DateTime CreatedAt { get; init; }
}

public sealed class RegisteredDeviceEntity
{
    public int Id { get; init; }
    public string DeviceName { get; init; } = string.Empty;
    public int UserId { get; init; }
    public string? UserName { get; init; }
    public string? UserEmail { get; init; }
    public bool IsActive { get; init; }
    public DateTime? LastLogin { get; init; }
    public DateTime RegisteredAt { get; init; }
    public int RegisteredBy { get; init; }
    public string? RegisteredByName { get; init; }
    public string? Notes { get; init; }
}

public sealed class RefreshTokenEntity
{
    public int Id { get; init; }
    public int UserId { get; init; }
    public string Token { get; init; } = string.Empty;
    public string DeviceName { get; init; } = string.Empty;
    public DateTime ExpiresAt { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime? RevokedAt { get; init; }
    public string? ReplacedByToken { get; init; }
}

public sealed class RevokedTokenEntity
{
    public string Jti { get; init; } = string.Empty;
    public int? UserId { get; init; }
    public string? DeviceName { get; init; }
    public string? Reason { get; init; }
    public DateTime ExpiresAt { get; init; }
    public DateTime RevokedAt { get; init; }
}

public sealed class ChartSliceEntity
{
    public string Label { get; init; } = string.Empty;
    public int Value { get; init; }
    public string? Color { get; init; }
}

public sealed class DashboardStatsEntity
{
    public int ActiveProjects { get; init; }
    public int OverdueTasks { get; init; }
    public int ExpiredLicenses { get; init; }
    public IReadOnlyCollection<ChartSliceEntity> ProjectsByType { get; init; } = [];
    public IReadOnlyCollection<ChartSliceEntity> ProjectsByStatus { get; init; } = [];
    public IReadOnlyCollection<ExecutiveUpdateEntity> RecentUpdates { get; init; } = [];
    public IReadOnlyCollection<LicenseEntity> ExpiringLicenses { get; init; } = [];
}
