using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using TechFlowPM.API.DTOs;
using TechFlowPM.API.Helpers;
using TechFlowPM.API.Services;

namespace TechFlowPM.API.Controllers;

public static class RouteMappings
{
    public static IEndpointRouteBuilder MapApiV1(this IEndpointRouteBuilder endpoints)
    {
        var api = endpoints.MapGroup("/api/v1");

        MapAuth(api);
        MapProjects(api);
        MapTasks(api);
        MapLicenses(api);
        MapUsers(api);
        MapDepartments(api);
        MapNotifications(api);
        MapDevices(api);

        return endpoints;
    }

    private static void MapAuth(RouteGroupBuilder api)
    {
        var auth = api.MapGroup("/auth").WithTags("Auth");

        auth.MapPost("/device-login", async (
            DeviceLoginRequest request,
            IValidator<DeviceLoginRequest> validator,
            IAuthService authService,
            CancellationToken cancellationToken) =>
        {
            await validator.ValidateAndThrowAsync(request, cancellationToken);
            var data = await authService.DeviceLoginAsync(request, cancellationToken);
            return Results.Ok(ApiResponse<AuthResponse>.SuccessResponse(data, "Device login succeeded."));
        })
        .WithName("DeviceLogin")
        .WithSummary("Authenticate user using a registered device name.")
        .AllowAnonymous();

        auth.MapPost("/login", async (
            LoginRequest request,
            IValidator<LoginRequest> validator,
            IAuthService authService,
            CancellationToken cancellationToken) =>
        {
            await validator.ValidateAndThrowAsync(request, cancellationToken);
            var data = await authService.LoginAsync(request, cancellationToken);
            return Results.Ok(ApiResponse<AuthResponse>.SuccessResponse(data, "Login succeeded."));
        })
        .WithName("Login")
        .WithSummary("Authenticate user using email and password.")
        .AllowAnonymous();

        auth.MapPost("/refresh", async (
            RefreshTokenRequest request,
            IValidator<RefreshTokenRequest> validator,
            IAuthService authService,
            CancellationToken cancellationToken) =>
        {
            await validator.ValidateAndThrowAsync(request, cancellationToken);
            var data = await authService.RefreshAsync(request, cancellationToken);
            return Results.Ok(ApiResponse<AuthResponse>.SuccessResponse(data, "Token refreshed successfully."));
        })
        .WithName("RefreshToken")
        .WithSummary("Refresh access token using refresh token.")
        .AllowAnonymous();

        auth.MapPost("/logout", async (
            LogoutRequest request,
            IValidator<LogoutRequest> validator,
            IAuthService authService,
            HttpContext httpContext,
            CancellationToken cancellationToken) =>
        {
            await validator.ValidateAndThrowAsync(request, cancellationToken);
            await authService.LogoutAsync(request, httpContext.User, cancellationToken);
            return Results.Ok(ApiResponse<object?>.SuccessResponse(null, "Logged out successfully."));
        })
        .WithName("Logout")
        .WithSummary("Logout current user and revoke tokens.")
        .RequireAuthorization(Policies.WorkspaceUser);
    }

    private static void MapProjects(RouteGroupBuilder api)
    {
        var projects = api.MapGroup("/projects")
            .WithTags("Projects")
            .RequireAuthorization(Policies.WorkspaceUser);

        projects.MapGet("/timeline", async (
            [AsParameters] TimelineQueryParameters query,
            IProjectService projectService,
            CancellationToken cancellationToken) =>
        {
            var data = await projectService.GetTimelineAsync(query, cancellationToken);
            return Results.Ok(ApiResponse<IReadOnlyCollection<ProjectTimelineItemDto>>.SuccessResponse(data, "Timeline loaded successfully."));
        })
        .WithName("GetProjectTimeline")
        .WithSummary("Get yearly Gantt timeline data for projects.");

        projects.MapGet("/stats", async (
            IProjectService projectService,
            CancellationToken cancellationToken) =>
        {
            var data = await projectService.GetDashboardStatsAsync(cancellationToken);
            return Results.Ok(ApiResponse<DashboardStatsDto>.SuccessResponse(data, "Dashboard stats loaded successfully."));
        })
        .WithName("GetProjectStats")
        .WithSummary("Get dashboard statistics and chart data.");

        projects.MapGet("/", async (
            [AsParameters] ProjectQueryParameters query,
            IProjectService projectService,
            CancellationToken cancellationToken) =>
        {
            var data = await projectService.GetProjectsAsync(query, cancellationToken);
            return Results.Ok(ApiResponse<PagedResult<ProjectListItemDto>>.SuccessResponse(data, "Projects loaded successfully."));
        })
        .WithName("GetProjects")
        .WithSummary("List projects with filtering and pagination.");

        projects.MapPost("/", async (
            CreateProjectRequest request,
            IValidator<CreateProjectRequest> validator,
            IProjectService projectService,
            CancellationToken cancellationToken) =>
        {
            await validator.ValidateAndThrowAsync(request, cancellationToken);
            var data = await projectService.CreateProjectAsync(request, cancellationToken);
            return Results.Created($"/api/v1/projects/{data.Project.Id}", ApiResponse<ProjectDetailDto>.SuccessResponse(data, "Project created successfully."));
        })
        .WithName("CreateProject")
        .WithSummary("Create a new project.")
        .RequireAuthorization(Policies.Management);

        projects.MapGet("/{id:int}", async (
            int id,
            IProjectService projectService,
            CancellationToken cancellationToken) =>
        {
            var data = await projectService.GetProjectAsync(id, cancellationToken);
            return Results.Ok(ApiResponse<ProjectDetailDto>.SuccessResponse(data, "Project details loaded successfully."));
        })
        .WithName("GetProjectById")
        .WithSummary("Get detailed project information.");

        projects.MapPut("/{id:int}", async (
            int id,
            UpdateProjectRequest request,
            IValidator<UpdateProjectRequest> validator,
            IProjectService projectService,
            CancellationToken cancellationToken) =>
        {
            await validator.ValidateAndThrowAsync(request, cancellationToken);
            var data = await projectService.UpdateProjectAsync(id, request, cancellationToken);
            return Results.Ok(ApiResponse<ProjectDetailDto>.SuccessResponse(data, "Project updated successfully."));
        })
        .WithName("UpdateProject")
        .WithSummary("Update an existing project.")
        .RequireAuthorization(Policies.Management);

        projects.MapDelete("/{id:int}", async (
            int id,
            IProjectService projectService,
            CancellationToken cancellationToken) =>
        {
            await projectService.DeleteProjectAsync(id, cancellationToken);
            return Results.Ok(ApiResponse<object?>.SuccessResponse(null, "Project deleted successfully."));
        })
        .WithName("DeleteProject")
        .WithSummary("Delete a project.")
        .RequireAuthorization(Policies.Management);

        projects.MapGet("/{id:int}/summary", async (
            int id,
            IProjectService projectService,
            CancellationToken cancellationToken) =>
        {
            var data = await projectService.GetSummaryAsync(id, cancellationToken);
            return Results.Ok(ApiResponse<ProjectSummaryDto>.SuccessResponse(data, "Project summary loaded successfully."));
        })
        .WithName("GetProjectSummary")
        .WithSummary("Get project executive summary.");

        projects.MapGet("/{id:int}/tasks", async (
            int id,
            ITaskService taskService,
            CancellationToken cancellationToken) =>
        {
            var data = await taskService.GetProjectTasksAsync(id, cancellationToken);
            return Results.Ok(ApiResponse<IReadOnlyCollection<TaskDto>>.SuccessResponse(data, "Project tasks loaded successfully."));
        })
        .WithName("GetProjectTasks")
        .WithSummary("Get tasks for a project.");

        projects.MapPost("/{id:int}/tasks", async (
            int id,
            CreateTaskRequest request,
            IValidator<CreateTaskRequest> validator,
            ITaskService taskService,
            CancellationToken cancellationToken) =>
        {
            await validator.ValidateAndThrowAsync(request, cancellationToken);
            var data = await taskService.CreateTaskAsync(id, request, cancellationToken);
            return Results.Created($"/api/v1/tasks/{data.Id}", ApiResponse<TaskDto>.SuccessResponse(data, "Task created successfully."));
        })
        .WithName("CreateProjectTask")
        .WithSummary("Create a task in a project.")
        .RequireAuthorization(Policies.Management);

        projects.MapGet("/{id:int}/updates", async (
            int id,
            IProjectService projectService,
            CancellationToken cancellationToken) =>
        {
            var data = await projectService.GetProjectUpdatesAsync(id, cancellationToken);
            return Results.Ok(ApiResponse<IReadOnlyCollection<ExecutiveUpdateDto>>.SuccessResponse(data, "Project updates loaded successfully."));
        })
        .WithName("GetProjectUpdates")
        .WithSummary("Get executive updates for a project.");

        projects.MapPost("/{id:int}/updates", async (
            int id,
            CreateExecutiveUpdateRequest request,
            IValidator<CreateExecutiveUpdateRequest> validator,
            IProjectService projectService,
            CancellationToken cancellationToken) =>
        {
            await validator.ValidateAndThrowAsync(request, cancellationToken);
            var data = await projectService.AddProjectUpdateAsync(id, request, cancellationToken);
            return Results.Created($"/api/v1/projects/{id}/updates/{data.Id}", ApiResponse<ExecutiveUpdateDto>.SuccessResponse(data, "Executive update added successfully."));
        })
        .WithName("AddProjectUpdate")
        .WithSummary("Add a new executive update to a project.")
        .RequireAuthorization(Policies.Management);

        projects.MapDelete("/{id:int}/updates/{updateId:int}", async (
            int id,
            int updateId,
            IProjectService projectService,
            CancellationToken cancellationToken) =>
        {
            await projectService.DeleteProjectUpdateAsync(id, updateId, cancellationToken);
            return Results.Ok(ApiResponse<object?>.SuccessResponse(null, "Executive update deleted successfully."));
        })
        .WithName("DeleteProjectUpdate")
        .WithSummary("Delete an executive update from a project.")
        .RequireAuthorization(Policies.Management);

        projects.MapPost("/{id:int}/members", async (
            int id,
            AddProjectMemberRequest request,
            IValidator<AddProjectMemberRequest> validator,
            IProjectService projectService,
            CancellationToken cancellationToken) =>
        {
            await validator.ValidateAndThrowAsync(request, cancellationToken);
            var data = await projectService.AddProjectMemberAsync(id, request, cancellationToken);
            return Results.Created($"/api/v1/projects/{id}/members/{data.UserId}", ApiResponse<ProjectMemberDto>.SuccessResponse(data, "Project member added successfully."));
        })
        .WithName("AddProjectMember")
        .WithSummary("Add a member to the project.")
        .RequireAuthorization(Policies.Management);

        projects.MapDelete("/{id:int}/members/{userId:int}", async (
            int id,
            int userId,
            IProjectService projectService,
            CancellationToken cancellationToken) =>
        {
            await projectService.RemoveProjectMemberAsync(id, userId, cancellationToken);
            return Results.Ok(ApiResponse<object?>.SuccessResponse(null, "Project member removed successfully."));
        })
        .WithName("RemoveProjectMember")
        .WithSummary("Remove a member from the project.")
        .RequireAuthorization(Policies.Management);
    }

    private static void MapTasks(RouteGroupBuilder api)
    {
        var tasks = api.MapGroup("/tasks")
            .WithTags("Tasks")
            .RequireAuthorization(Policies.WorkspaceUser);

        tasks.MapPut("/{id:int}", async (
            int id,
            UpdateTaskRequest request,
            IValidator<UpdateTaskRequest> validator,
            ITaskService taskService,
            CancellationToken cancellationToken) =>
        {
            await validator.ValidateAndThrowAsync(request, cancellationToken);
            var data = await taskService.UpdateTaskAsync(id, request, cancellationToken);
            return Results.Ok(ApiResponse<TaskDto>.SuccessResponse(data, "Task updated successfully."));
        })
        .WithName("UpdateTask")
        .WithSummary("Update a task.");

        tasks.MapPatch("/{id:int}/status", async (
            int id,
            UpdateTaskStatusRequest request,
            IValidator<UpdateTaskStatusRequest> validator,
            ITaskService taskService,
            CancellationToken cancellationToken) =>
        {
            await validator.ValidateAndThrowAsync(request, cancellationToken);
            var data = await taskService.UpdateTaskStatusAsync(id, request, cancellationToken);
            return Results.Ok(ApiResponse<TaskDto>.SuccessResponse(data, "Task status updated successfully."));
        })
        .WithName("UpdateTaskStatus")
        .WithSummary("Update task status and emit realtime event.");

        tasks.MapDelete("/{id:int}", async (
            int id,
            ITaskService taskService,
            CancellationToken cancellationToken) =>
        {
            await taskService.DeleteTaskAsync(id, cancellationToken);
            return Results.Ok(ApiResponse<object?>.SuccessResponse(null, "Task deleted successfully."));
        })
        .WithName("DeleteTask")
        .WithSummary("Delete a task.");
    }

    private static void MapLicenses(RouteGroupBuilder api)
    {
        var licenses = api.MapGroup("/licenses")
            .WithTags("Licenses")
            .RequireAuthorization(Policies.WorkspaceUser);

        licenses.MapGet("/", async (
            [AsParameters] LicenseQueryParameters query,
            ILicenseService licenseService,
            CancellationToken cancellationToken) =>
        {
            var data = await licenseService.GetLicensesAsync(query, cancellationToken);
            return Results.Ok(ApiResponse<PagedResult<LicenseDto>>.SuccessResponse(data, "Licenses loaded successfully."));
        })
        .WithName("GetLicenses")
        .WithSummary("List licenses with filtering and pagination.");

        licenses.MapGet("/expiring-soon", async (
            [FromQuery] int days,
            ILicenseService licenseService,
            CancellationToken cancellationToken) =>
        {
            var window = days > 0 ? days : 30;
            var data = await licenseService.GetExpiringSoonAsync(window, cancellationToken);
            return Results.Ok(ApiResponse<IReadOnlyCollection<LicenseDto>>.SuccessResponse(data, "Expiring licenses loaded successfully."));
        })
        .WithName("GetExpiringLicenses")
        .WithSummary("Get licenses that are expiring soon.");

        licenses.MapPost("/", async (
            CreateLicenseRequest request,
            IValidator<CreateLicenseRequest> validator,
            ILicenseService licenseService,
            CancellationToken cancellationToken) =>
        {
            await validator.ValidateAndThrowAsync(request, cancellationToken);
            var data = await licenseService.CreateAsync(request, cancellationToken);
            return Results.Created($"/api/v1/licenses/{data.Id}", ApiResponse<LicenseDto>.SuccessResponse(data, "License created successfully."));
        })
        .WithName("CreateLicense")
        .WithSummary("Create a new license record.")
        .RequireAuthorization(Policies.Management);

        licenses.MapPut("/{id:int}", async (
            int id,
            UpdateLicenseRequest request,
            IValidator<UpdateLicenseRequest> validator,
            ILicenseService licenseService,
            CancellationToken cancellationToken) =>
        {
            await validator.ValidateAndThrowAsync(request, cancellationToken);
            var data = await licenseService.UpdateAsync(id, request, cancellationToken);
            return Results.Ok(ApiResponse<LicenseDto>.SuccessResponse(data, "License updated successfully."));
        })
        .WithName("UpdateLicense")
        .WithSummary("Update a license.")
        .RequireAuthorization(Policies.Management);

        licenses.MapDelete("/{id:int}", async (
            int id,
            ILicenseService licenseService,
            CancellationToken cancellationToken) =>
        {
            await licenseService.DeleteAsync(id, cancellationToken);
            return Results.Ok(ApiResponse<object?>.SuccessResponse(null, "License deleted successfully."));
        })
        .WithName("DeleteLicense")
        .WithSummary("Delete a license.")
        .RequireAuthorization(Policies.Management);
    }

    private static void MapUsers(RouteGroupBuilder api)
    {
        var users = api.MapGroup("/users")
            .WithTags("Users");

        users.MapGet("/", async (
            [AsParameters] UserQueryParameters query,
            IUserService userService,
            CancellationToken cancellationToken) =>
        {
            var data = await userService.GetUsersAsync(query, cancellationToken);
            return Results.Ok(ApiResponse<PagedResult<UserDto>>.SuccessResponse(data, "Users loaded successfully."));
        })
        .WithName("GetUsers")
        .WithSummary("Get employees list.")
        .RequireAuthorization(Policies.WorkspaceUser);

        users.MapPost("/", async (
            CreateUserRequest request,
            IValidator<CreateUserRequest> validator,
            IUserService userService,
            CancellationToken cancellationToken) =>
        {
            await validator.ValidateAndThrowAsync(request, cancellationToken);
            var data = await userService.CreateUserAsync(request, cancellationToken);
            return Results.Created($"/api/v1/users/{data.Id}", ApiResponse<UserDto>.SuccessResponse(data, "User created successfully."));
        })
        .WithName("CreateUser")
        .WithSummary("Create a new system user.")
        .RequireAuthorization(Policies.AdminOnly);

        users.MapPut("/{id:int}", async (
            int id,
            UpdateUserRequest request,
            IValidator<UpdateUserRequest> validator,
            IUserService userService,
            CancellationToken cancellationToken) =>
        {
            await validator.ValidateAndThrowAsync(request, cancellationToken);
            var data = await userService.UpdateUserAsync(id, request, cancellationToken);
            return Results.Ok(ApiResponse<UserDto>.SuccessResponse(data, "User updated successfully."));
        })
        .WithName("UpdateUser")
        .WithSummary("Update an existing user.")
        .RequireAuthorization(Policies.AdminOnly);
    }

    private static void MapDepartments(RouteGroupBuilder api)
    {
        var departments = api.MapGroup("/departments")
            .WithTags("Departments");

        departments.MapGet("/", async (
            IDepartmentService departmentService,
            CancellationToken cancellationToken) =>
        {
            var data = await departmentService.GetDepartmentsAsync(cancellationToken);
            return Results.Ok(ApiResponse<IReadOnlyCollection<DepartmentDto>>.SuccessResponse(data, "Departments loaded successfully."));
        })
        .WithName("GetDepartments")
        .WithSummary("Get departments list.")
        .RequireAuthorization(Policies.WorkspaceUser);

        departments.MapPost("/", async (
            CreateDepartmentRequest request,
            IValidator<CreateDepartmentRequest> validator,
            IDepartmentService departmentService,
            CancellationToken cancellationToken) =>
        {
            await validator.ValidateAndThrowAsync(request, cancellationToken);
            var data = await departmentService.CreateDepartmentAsync(request, cancellationToken);
            return Results.Created($"/api/v1/departments/{data.Id}", ApiResponse<DepartmentDto>.SuccessResponse(data, "Department created successfully."));
        })
        .WithName("CreateDepartment")
        .WithSummary("Create a new department.")
        .RequireAuthorization(Policies.AdminOnly);
    }

    private static void MapNotifications(RouteGroupBuilder api)
    {
        var notifications = api.MapGroup("/notifications")
            .WithTags("Notifications")
            .RequireAuthorization(Policies.WorkspaceUser);

        notifications.MapGet("/", async (
            [AsParameters] NotificationQueryParameters query,
            INotificationService notificationService,
            CancellationToken cancellationToken) =>
        {
            var data = await notificationService.GetNotificationsAsync(query, cancellationToken);
            return Results.Ok(ApiResponse<PagedResult<NotificationDto>>.SuccessResponse(data, "Notifications loaded successfully."));
        })
        .WithName("GetNotifications")
        .WithSummary("Get current user's notifications.");

        notifications.MapPatch("/mark-read", async (
            MarkNotificationsReadRequest request,
            INotificationService notificationService,
            CancellationToken cancellationToken) =>
        {
            var affected = await notificationService.MarkReadAsync(request, cancellationToken);
            return Results.Ok(ApiResponse<object>.SuccessResponse(new { affected }, "Notifications marked as read."));
        })
        .WithName("MarkNotificationsRead")
        .WithSummary("Mark notifications as read.");
    }

    private static void MapDevices(RouteGroupBuilder api)
    {
        var devices = api.MapGroup("/admin/devices")
            .WithTags("Admin Devices")
            .RequireAuthorization(Policies.AdminOnly);

        devices.MapGet("/", async (
            [AsParameters] DeviceQueryParameters query,
            IDeviceAdminService deviceService,
            CancellationToken cancellationToken) =>
        {
            var data = await deviceService.GetDevicesAsync(query, cancellationToken);
            return Results.Ok(ApiResponse<PagedResult<RegisteredDeviceDto>>.SuccessResponse(data, "Devices loaded successfully."));
        })
        .WithName("GetDevices")
        .WithSummary("Get registered devices.");

        devices.MapPost("/", async (
            RegisterDeviceRequest request,
            IValidator<RegisterDeviceRequest> validator,
            IDeviceAdminService deviceService,
            CancellationToken cancellationToken) =>
        {
            await validator.ValidateAndThrowAsync(request, cancellationToken);
            var data = await deviceService.RegisterAsync(request, cancellationToken);
            return Results.Created($"/api/v1/admin/devices/{data.Id}", ApiResponse<RegisteredDeviceDto>.SuccessResponse(data, "Device registered successfully."));
        })
        .WithName("RegisterDevice")
        .WithSummary("Register a new device.");

        devices.MapPatch("/{id:int}", async (
            int id,
            ToggleDeviceRequest request,
            IValidator<ToggleDeviceRequest> validator,
            IDeviceAdminService deviceService,
            CancellationToken cancellationToken) =>
        {
            await validator.ValidateAndThrowAsync(request, cancellationToken);
            var data = await deviceService.ToggleAsync(id, request, cancellationToken);
            return Results.Ok(ApiResponse<RegisteredDeviceDto>.SuccessResponse(data, "Device updated successfully."));
        })
        .WithName("ToggleDevice")
        .WithSummary("Activate or deactivate a device.");

        devices.MapDelete("/{id:int}", async (
            int id,
            IDeviceAdminService deviceService,
            CancellationToken cancellationToken) =>
        {
            await deviceService.DeleteAsync(id, cancellationToken);
            return Results.Ok(ApiResponse<object?>.SuccessResponse(null, "Device deleted successfully."));
        })
        .WithName("DeleteDevice")
        .WithSummary("Delete a device.");
    }
}
