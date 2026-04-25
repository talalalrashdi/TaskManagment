using FluentValidation;
using TechFlowPM.API.Models;

namespace TechFlowPM.API.DTOs;

public sealed record ApiResponse<T>(bool Success, T? Data, string Message, IReadOnlyCollection<string> Errors)
{
    public static ApiResponse<T> SuccessResponse(T? data, string message = "Request completed successfully.")
        => new(true, data, message, []);

    public static ApiResponse<T> Failure(string message, params string[] errors)
        => new(false, default, message, errors);
}

public sealed record PagedResult<T>(
    IReadOnlyCollection<T> Items,
    int TotalCount,
    int Page,
    int PageSize)
{
    public int TotalPages => TotalCount == 0 ? 0 : (int)Math.Ceiling(TotalCount / (double)PageSize);
}

public abstract record PagedQuery
{
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 10;
    public string? Search { get; init; }
}

public sealed record ProjectQueryParameters : PagedQuery
{
    public string? Type { get; init; }
    public string? Status { get; init; }
    public string? Priority { get; init; }
    public int? ProjectManagerId { get; init; }
    public int? DepartmentId { get; init; }
    public int? MemberUserId { get; init; }
}

public sealed record LicenseQueryParameters : PagedQuery
{
    public string? Type { get; init; }
    public string? Status { get; init; }
    public int? ProjectId { get; init; }
    public int? ExpiringInDays { get; init; }
}

public sealed record UserQueryParameters : PagedQuery
{
    public int? DepartmentId { get; init; }
    public string? Role { get; init; }
}

public sealed record DeviceQueryParameters : PagedQuery
{
    public bool? IsActive { get; init; }
}

public sealed record NotificationQueryParameters : PagedQuery
{
    public string? Type { get; init; }
    public bool? IsRead { get; init; }
}

public sealed record TimelineQueryParameters
{
    public int Year { get; init; } = DateTime.UtcNow.Year;
    public string? Type { get; init; }
    public string? Status { get; init; }
    public int? DepartmentId { get; init; }
}

public sealed record ChartSliceDto(string Label, int Value, string? Color);

public sealed record DepartmentDto(int Id, string Name, string Type, string Color, string Icon);

public sealed record UserDto(
    int Id,
    string Name,
    string Email,
    string Role,
    string? Avatar,
    int? DepartmentId,
    string? DepartmentName,
    string? DepartmentType,
    DateTime CreatedAt);

public sealed record ProjectMemberDto(
    int Id,
    int ProjectId,
    int UserId,
    string RoleInProject,
    DateTime JoinedAt,
    string UserName,
    string? UserEmail,
    string? UserAvatar);

public sealed record TaskAssigneeDto(
    int UserId,
    string UserName,
    string? UserEmail,
    string? UserAvatar);

public sealed record TaskDto(
    int Id,
    int ProjectId,
    string Title,
    string Description,
    int? AssignedToId,
    string? AssignedToName,
    IReadOnlyCollection<TaskAssigneeDto> Assignees,
    int CreatedById,
    string? CreatedByName,
    string Status,
    string Priority,
    DateTime? DueDate,
    decimal EstimatedHours,
    decimal ActualHours,
    int OrderIndex,
    DateTime CreatedAt);

public sealed record ExecutiveUpdateDto(
    int Id,
    int ProjectId,
    string Content,
    string UpdateType,
    int CreatedById,
    string? CreatedByName,
    DateTime CreatedAt);

public sealed record LicenseDto(
    int Id,
    string Name,
    string Type,
    string KeyValue,
    string MaskedKeyValue,
    string Vendor,
    DateTime PurchaseDate,
    DateTime ExpiryDate,
    decimal Cost,
    int RenewalReminderDays,
    int? ProjectId,
    string? ProjectTitle,
    string Notes,
    string Status,
    int DaysUntilExpiry);

public sealed record NotificationDto(
    int Id,
    string Title,
    string Message,
    string Type,
    bool IsRead,
    string? RelatedEntityType,
    int? RelatedEntityId,
    DateTime CreatedAt);

public sealed record RegisteredDeviceDto(
    int Id,
    string DeviceName,
    int UserId,
    string? UserName,
    string? UserEmail,
    bool IsActive,
    DateTime? LastLogin,
    DateTime RegisteredAt,
    int RegisteredBy,
    string? RegisteredByName,
    string? Notes);

public sealed record ProjectListItemDto(
    int Id,
    string Title,
    string Description,
    string Type,
    string Status,
    string Priority,
    int ProjectManagerId,
    string? ProjectManagerName,
    int ResponsibleDepartmentId,
    string? ResponsibleDepartmentName,
    string? ResponsibleDepartmentColor,
    int BeneficiaryDepartmentId,
    string? BeneficiaryDepartmentName,
    decimal Budget,
    decimal ActualCost,
    DateTime StartDate,
    DateTime EndDate,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    int TotalTasks,
    int CompletedTasks,
    int BlockedTasks,
    int TeamSize,
    decimal ProgressPercent);

public sealed record ProjectDetailDto(
    ProjectListItemDto Project,
    IReadOnlyCollection<ProjectMemberDto> Members,
    IReadOnlyCollection<ExecutiveUpdateDto> RecentUpdates);

public sealed record ProjectSummaryDto(
    int ProjectId,
    decimal CompletionPercent,
    int TotalTasks,
    int DoneTasks,
    int InProgressTasks,
    int BlockedTasks,
    decimal Budget,
    decimal ActualCost,
    decimal Variance,
    int TeamSize,
    IReadOnlyCollection<ExecutiveUpdateDto> LatestUpdates);

public sealed record ProjectTimelineItemDto(
    int Id,
    string Title,
    string Type,
    string Status,
    DateTime StartDate,
    DateTime EndDate,
    string? ResponsibleDepartmentName,
    string? ResponsibleDepartmentColor,
    decimal ProgressPercent);

public sealed record DashboardStatsDto(
    int ActiveProjects,
    int OverdueTasks,
    int ExpiredLicenses,
    IReadOnlyCollection<ChartSliceDto> ProjectsByType,
    IReadOnlyCollection<ChartSliceDto> ProjectsByStatus,
    IReadOnlyCollection<ExecutiveUpdateDto> RecentUpdates,
    IReadOnlyCollection<LicenseDto> ExpiringLicenses);

public sealed record LoginRequest(string Email, string Password);

public sealed record DeviceLoginRequest(string DeviceName);

public sealed record RefreshTokenRequest(string RefreshToken);

public sealed record LogoutRequest(string RefreshToken);

public sealed record AuthResponse(
    string Token,
    string RefreshToken,
    UserDto User,
    DateTime ExpiresAtUtc,
    DateTime RefreshExpiresAtUtc);

public sealed record CreateProjectRequest(
    string Title,
    string Description,
    string Type,
    string Status,
    string Priority,
    int ProjectManagerId,
    int ResponsibleDepartmentId,
    int BeneficiaryDepartmentId,
    decimal Budget,
    decimal ActualCost,
    DateTime StartDate,
    DateTime EndDate);

public sealed record UpdateProjectRequest(
    string Title,
    string Description,
    string Type,
    string Status,
    string Priority,
    int ProjectManagerId,
    int ResponsibleDepartmentId,
    int BeneficiaryDepartmentId,
    decimal Budget,
    decimal ActualCost,
    DateTime StartDate,
    DateTime EndDate);

public sealed record CreateTaskRequest(
    string Title,
    string Description,
    int? AssignedToId,
    IReadOnlyCollection<int>? AssignedUserIds,
    string Status,
    string Priority,
    DateTime? DueDate,
    decimal EstimatedHours,
    decimal ActualHours,
    int OrderIndex);

public sealed record UpdateTaskRequest(
    string Title,
    string Description,
    int? AssignedToId,
    IReadOnlyCollection<int>? AssignedUserIds,
    string Status,
    string Priority,
    DateTime? DueDate,
    decimal EstimatedHours,
    decimal ActualHours,
    int OrderIndex);

public sealed record UpdateTaskStatusRequest(string Status);

public sealed record CreateExecutiveUpdateRequest(string Content, string UpdateType);

public sealed record CreateLicenseRequest(
    string Name,
    string Type,
    string KeyValue,
    string Vendor,
    DateTime PurchaseDate,
    DateTime ExpiryDate,
    decimal Cost,
    int RenewalReminderDays,
    int? ProjectId,
    string Notes);

public sealed record UpdateLicenseRequest(
    string Name,
    string Type,
    string? KeyValue,
    string Vendor,
    DateTime PurchaseDate,
    DateTime ExpiryDate,
    decimal Cost,
    int RenewalReminderDays,
    int? ProjectId,
    string Notes);

public sealed record AddProjectMemberRequest(int UserId, string RoleInProject);

public sealed record MarkNotificationsReadRequest(IReadOnlyCollection<int>? NotificationIds);

public sealed record RegisterDeviceRequest(string DeviceName, int UserId, string? Notes);

public sealed record ToggleDeviceRequest(bool IsActive);

public sealed class DeviceLoginRequestValidator : AbstractValidator<DeviceLoginRequest>
{
    public DeviceLoginRequestValidator()
    {
        RuleFor(static request => request.DeviceName)
            .NotEmpty()
            .MinimumLength(3)
            .MaximumLength(100);
    }
}

public sealed class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(static request => request.Email).NotEmpty().EmailAddress();
        RuleFor(static request => request.Password).NotEmpty().MinimumLength(8);
    }
}

public sealed class RefreshTokenRequestValidator : AbstractValidator<RefreshTokenRequest>
{
    public RefreshTokenRequestValidator()
    {
        RuleFor(static request => request.RefreshToken).NotEmpty();
    }
}

public sealed class LogoutRequestValidator : AbstractValidator<LogoutRequest>
{
    public LogoutRequestValidator()
    {
        RuleFor(static request => request.RefreshToken).NotEmpty();
    }
}

public sealed class CreateProjectRequestValidator : AbstractValidator<CreateProjectRequest>
{
    public CreateProjectRequestValidator()
    {
        RuleFor(static request => request.Title).MaximumLength(200);
        RuleFor(static request => request.Description).MaximumLength(4000);
        RuleFor(static request => request.Type)
            .Must(static value => string.IsNullOrWhiteSpace(value) || ValidationRuleSet.BeProjectType(value))
            .WithMessage("Invalid project type.");
        RuleFor(static request => request.Status)
            .Must(static value => string.IsNullOrWhiteSpace(value) || ValidationRuleSet.BeProjectStatus(value))
            .WithMessage("Invalid project status.");
        RuleFor(static request => request.Priority)
            .Must(static value => string.IsNullOrWhiteSpace(value) || ValidationRuleSet.BePriority(value))
            .WithMessage("Invalid priority.");
        RuleFor(static request => request.ProjectManagerId).GreaterThanOrEqualTo(0);
        RuleFor(static request => request.ResponsibleDepartmentId).GreaterThanOrEqualTo(0);
        RuleFor(static request => request.BeneficiaryDepartmentId).GreaterThanOrEqualTo(0);
        RuleFor(static request => request.Budget).GreaterThanOrEqualTo(0);
        RuleFor(static request => request.ActualCost).GreaterThanOrEqualTo(0);
        RuleFor(static request => request)
            .Must(static request => request.EndDate == default || request.StartDate == default || request.EndDate >= request.StartDate)
            .WithMessage("End date must be greater than or equal to start date.");
    }
}

public sealed class UpdateProjectRequestValidator : AbstractValidator<UpdateProjectRequest>
{
    public UpdateProjectRequestValidator()
    {
        RuleFor(static request => request.Title).NotEmpty().MaximumLength(200);
        RuleFor(static request => request.Description).NotEmpty().MaximumLength(4000);
        RuleFor(static request => request.Type).Must(ValidationRuleSet.BeProjectType).WithMessage("Invalid project type.");
        RuleFor(static request => request.Status).Must(ValidationRuleSet.BeProjectStatus).WithMessage("Invalid project status.");
        RuleFor(static request => request.Priority).Must(ValidationRuleSet.BePriority).WithMessage("Invalid priority.");
        RuleFor(static request => request.ProjectManagerId).GreaterThan(0);
        RuleFor(static request => request.ResponsibleDepartmentId).GreaterThan(0);
        RuleFor(static request => request.BeneficiaryDepartmentId).GreaterThan(0);
        RuleFor(static request => request.Budget).GreaterThanOrEqualTo(0);
        RuleFor(static request => request.ActualCost).GreaterThanOrEqualTo(0);
        RuleFor(static request => request.EndDate).GreaterThanOrEqualTo(static request => request.StartDate);
    }
}

public sealed class CreateTaskRequestValidator : AbstractValidator<CreateTaskRequest>
{
    public CreateTaskRequestValidator()
    {
        RuleFor(static request => request.Title).NotEmpty().MaximumLength(200);
        RuleFor(static request => request.Description).MaximumLength(4000);
        RuleForEach(static request => request.AssignedUserIds)
            .GreaterThan(0);
        RuleFor(static request => request.Status).Must(ValidationRuleSet.BeTaskStatus).WithMessage("Invalid task status.");
        RuleFor(static request => request.Priority).Must(ValidationRuleSet.BePriority).WithMessage("Invalid priority.");
        RuleFor(static request => request.EstimatedHours).GreaterThanOrEqualTo(0);
        RuleFor(static request => request.ActualHours).GreaterThanOrEqualTo(0);
        RuleFor(static request => request.OrderIndex).GreaterThanOrEqualTo(0);
    }
}

public sealed class UpdateTaskRequestValidator : AbstractValidator<UpdateTaskRequest>
{
    public UpdateTaskRequestValidator()
    {
        RuleFor(static request => request.Title).NotEmpty().MaximumLength(200);
        RuleFor(static request => request.Description).MaximumLength(4000);
        RuleForEach(static request => request.AssignedUserIds)
            .GreaterThan(0);
        RuleFor(static request => request.Status).Must(ValidationRuleSet.BeTaskStatus).WithMessage("Invalid task status.");
        RuleFor(static request => request.Priority).Must(ValidationRuleSet.BePriority).WithMessage("Invalid priority.");
        RuleFor(static request => request.EstimatedHours).GreaterThanOrEqualTo(0);
        RuleFor(static request => request.ActualHours).GreaterThanOrEqualTo(0);
        RuleFor(static request => request.OrderIndex).GreaterThanOrEqualTo(0);
    }
}

public sealed class UpdateTaskStatusRequestValidator : AbstractValidator<UpdateTaskStatusRequest>
{
    public UpdateTaskStatusRequestValidator()
    {
        RuleFor(static request => request.Status).Must(ValidationRuleSet.BeTaskStatus).WithMessage("Invalid task status.");
    }
}

public sealed class CreateExecutiveUpdateRequestValidator : AbstractValidator<CreateExecutiveUpdateRequest>
{
    public CreateExecutiveUpdateRequestValidator()
    {
        RuleFor(static request => request.Content).NotEmpty().MaximumLength(4000);
        RuleFor(static request => request.UpdateType).Must(ValidationRuleSet.BeUpdateType).WithMessage("Invalid update type.");
    }
}

public sealed class CreateLicenseRequestValidator : AbstractValidator<CreateLicenseRequest>
{
    public CreateLicenseRequestValidator()
    {
        RuleFor(static request => request.Name).NotEmpty().MaximumLength(200);
        RuleFor(static request => request.Type).Must(ValidationRuleSet.BeLicenseType).WithMessage("Invalid license type.");
        RuleFor(static request => request.KeyValue).NotEmpty().MaximumLength(500);
        RuleFor(static request => request.Vendor).NotEmpty().MaximumLength(200);
        RuleFor(static request => request.Cost).GreaterThanOrEqualTo(0);
        RuleFor(static request => request.RenewalReminderDays).InclusiveBetween(1, 365);
        RuleFor(static request => request.ExpiryDate).GreaterThanOrEqualTo(static request => request.PurchaseDate);
        RuleFor(static request => request.Notes).MaximumLength(4000);
    }
}

public sealed class UpdateLicenseRequestValidator : AbstractValidator<UpdateLicenseRequest>
{
    public UpdateLicenseRequestValidator()
    {
        RuleFor(static request => request.Name).NotEmpty().MaximumLength(200);
        RuleFor(static request => request.Type).Must(ValidationRuleSet.BeLicenseType).WithMessage("Invalid license type.");
        RuleFor(static request => request.KeyValue).MaximumLength(500);
        RuleFor(static request => request.Vendor).NotEmpty().MaximumLength(200);
        RuleFor(static request => request.Cost).GreaterThanOrEqualTo(0);
        RuleFor(static request => request.RenewalReminderDays).InclusiveBetween(1, 365);
        RuleFor(static request => request.ExpiryDate).GreaterThanOrEqualTo(static request => request.PurchaseDate);
        RuleFor(static request => request.Notes).MaximumLength(4000);
    }
}

public sealed class AddProjectMemberRequestValidator : AbstractValidator<AddProjectMemberRequest>
{
    public AddProjectMemberRequestValidator()
    {
        RuleFor(static request => request.UserId).GreaterThan(0);
        RuleFor(static request => request.RoleInProject).NotEmpty().MaximumLength(100);
    }
}

public sealed class RegisterDeviceRequestValidator : AbstractValidator<RegisterDeviceRequest>
{
    public RegisterDeviceRequestValidator()
    {
        RuleFor(static request => request.DeviceName).NotEmpty().MinimumLength(3).MaximumLength(100);
        RuleFor(static request => request.UserId).GreaterThan(0);
        RuleFor(static request => request.Notes).MaximumLength(255);
    }
}

public sealed class ToggleDeviceRequestValidator : AbstractValidator<ToggleDeviceRequest>
{
    public ToggleDeviceRequestValidator()
    {
    }
}

internal static class ValidationRuleSet
{
    public static bool BeProjectType(string? value) => !string.IsNullOrWhiteSpace(value) && DomainLookups.ProjectTypes.Contains(value, StringComparer.OrdinalIgnoreCase);
    public static bool BeProjectStatus(string? value) => !string.IsNullOrWhiteSpace(value) && DomainLookups.ProjectStatuses.Contains(value, StringComparer.OrdinalIgnoreCase);
    public static bool BePriority(string? value) => !string.IsNullOrWhiteSpace(value) && DomainLookups.Priorities.Contains(value, StringComparer.OrdinalIgnoreCase);
    public static bool BeTaskStatus(string? value) => !string.IsNullOrWhiteSpace(value) && DomainLookups.TaskStatuses.Contains(value, StringComparer.OrdinalIgnoreCase);
    public static bool BeUpdateType(string? value) => !string.IsNullOrWhiteSpace(value) && DomainLookups.UpdateTypes.Contains(value, StringComparer.OrdinalIgnoreCase);
    public static bool BeLicenseType(string? value) => !string.IsNullOrWhiteSpace(value) && DomainLookups.LicenseTypes.Contains(value, StringComparer.OrdinalIgnoreCase);
}
