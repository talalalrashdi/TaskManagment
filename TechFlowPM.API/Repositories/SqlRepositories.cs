using System.Text;
using Dapper;
using TechFlowPM.API.Data;
using TechFlowPM.API.DTOs;
using TechFlowPM.API.Models;

namespace TechFlowPM.API.Repositories;

public sealed class UserRepository(ISqlConnectionFactory connectionFactory) : IUserRepository
{
    public async Task<UserEntity?> GetByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT
                u.id AS Id,
                u.name AS Name,
                u.email AS Email,
                u.password_hash AS PasswordHash,
                u.role AS Role,
                u.avatar AS Avatar,
                u.department_id AS DepartmentId,
                d.name AS DepartmentName,
                d.type AS DepartmentType,
                u.created_at AS CreatedAt
            FROM dbo.Users u
            LEFT JOIN dbo.Departments d ON d.id = u.department_id
            WHERE u.id = @Id;
            """;

        using var connection = connectionFactory.CreateConnection();
        return await connection.QuerySingleOrDefaultAsync<UserEntity>(new CommandDefinition(sql, new { Id = id }, cancellationToken: cancellationToken));
    }

    public async Task<UserEntity?> GetByEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT
                u.id AS Id,
                u.name AS Name,
                u.email AS Email,
                u.password_hash AS PasswordHash,
                u.role AS Role,
                u.avatar AS Avatar,
                u.department_id AS DepartmentId,
                d.name AS DepartmentName,
                d.type AS DepartmentType,
                u.created_at AS CreatedAt
            FROM dbo.Users u
            LEFT JOIN dbo.Departments d ON d.id = u.department_id
            WHERE u.email = @Email;
            """;

        using var connection = connectionFactory.CreateConnection();
        return await connection.QuerySingleOrDefaultAsync<UserEntity>(new CommandDefinition(sql, new { Email = email }, cancellationToken: cancellationToken));
    }

    public async Task<(IReadOnlyCollection<UserEntity> Items, int TotalCount)> GetUsersAsync(UserQueryParameters query, CancellationToken cancellationToken = default)
    {
        var parameters = new DynamicParameters();
        var whereClause = BuildUserWhere(query, parameters);

        parameters.Add("Offset", RepositoryPaging.GetOffset(query.Page, query.PageSize));
        parameters.Add("PageSize", RepositoryPaging.NormalizePageSize(query.PageSize));

        var sql = $"""
            SELECT
                u.id AS Id,
                u.name AS Name,
                u.email AS Email,
                u.password_hash AS PasswordHash,
                u.role AS Role,
                u.avatar AS Avatar,
                u.department_id AS DepartmentId,
                d.name AS DepartmentName,
                d.type AS DepartmentType,
                u.created_at AS CreatedAt
            FROM dbo.Users u
            LEFT JOIN dbo.Departments d ON d.id = u.department_id
            {whereClause}
            ORDER BY u.name ASC
            OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;

            SELECT COUNT(1)
            FROM dbo.Users u
            LEFT JOIN dbo.Departments d ON d.id = u.department_id
            {whereClause};
            """;

        using var connection = connectionFactory.CreateConnection();
        using var multi = await connection.QueryMultipleAsync(new CommandDefinition(sql, parameters, cancellationToken: cancellationToken));
        var items = (await multi.ReadAsync<UserEntity>()).AsList();
        var totalCount = await multi.ReadSingleAsync<int>();
        return (items, totalCount);
    }

    public async Task<int> CreateAsync(UserEntity user, CancellationToken cancellationToken = default)
    {
        const string sql = """
            INSERT INTO dbo.Users (name, email, password_hash, role, avatar, department_id)
            VALUES (@Name, @Email, @PasswordHash, @Role, @Avatar, @DepartmentId);

            SELECT CAST(SCOPE_IDENTITY() AS INT);
            """;

        using var connection = connectionFactory.CreateConnection();
        return await connection.ExecuteScalarAsync<int>(new CommandDefinition(sql, user, cancellationToken: cancellationToken));
    }

    public async Task<bool> UpdateAsync(UserEntity user, CancellationToken cancellationToken = default)
    {
        const string sql = """
            UPDATE dbo.Users
            SET
                name = @Name,
                role = @Role,
                avatar = @Avatar,
                department_id = @DepartmentId
            WHERE id = @Id;
            """;

        using var connection = connectionFactory.CreateConnection();
        var affectedRows = await connection.ExecuteAsync(new CommandDefinition(sql, user, cancellationToken: cancellationToken));
        return affectedRows > 0;
    }

    private static string BuildUserWhere(UserQueryParameters query, DynamicParameters parameters)
    {
        var conditions = new List<string>();
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            conditions.Add("(u.name LIKE @Search OR u.email LIKE @Search)");
            parameters.Add("Search", $"%{query.Search.Trim()}%");
        }

        if (query.DepartmentId is > 0)
        {
            conditions.Add("u.department_id = @DepartmentId");
            parameters.Add("DepartmentId", query.DepartmentId);
        }

        if (!string.IsNullOrWhiteSpace(query.Role))
        {
            conditions.Add("u.role = @Role");
            parameters.Add("Role", query.Role.Trim());
        }

        return conditions.Count == 0 ? string.Empty : $"WHERE {string.Join(" AND ", conditions)}";
    }
}

public sealed class DepartmentRepository(ISqlConnectionFactory connectionFactory) : IDepartmentRepository
{
    public async Task<IReadOnlyCollection<DepartmentEntity>> GetDepartmentsAsync(CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT
                d.id AS Id,
                d.name AS Name,
                d.type AS Type,
                d.color AS Color,
                d.icon AS Icon
            FROM dbo.Departments d
            ORDER BY d.name ASC;
            """;

        using var connection = connectionFactory.CreateConnection();
        return (await connection.QueryAsync<DepartmentEntity>(new CommandDefinition(sql, cancellationToken: cancellationToken))).AsList();
    }

    public async Task<DepartmentEntity?> GetByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT
                d.id AS Id,
                d.name AS Name,
                d.type AS Type,
                d.color AS Color,
                d.icon AS Icon
            FROM dbo.Departments d
            WHERE d.id = @Id;
            """;

        using var connection = connectionFactory.CreateConnection();
        return await connection.QuerySingleOrDefaultAsync<DepartmentEntity>(new CommandDefinition(sql, new { Id = id }, cancellationToken: cancellationToken));
    }

    public async Task<int> CreateAsync(DepartmentEntity department, CancellationToken cancellationToken = default)
    {
        const string sql = """
            INSERT INTO dbo.Departments (name, type, color, icon)
            VALUES (@Name, @Type, @Color, @Icon);

            SELECT CAST(SCOPE_IDENTITY() AS INT);
            """;

        using var connection = connectionFactory.CreateConnection();
        return await connection.ExecuteScalarAsync<int>(new CommandDefinition(sql, department, cancellationToken: cancellationToken));
    }
}

public sealed class ProjectRepository(ISqlConnectionFactory connectionFactory) : IProjectRepository
{
    public async Task<(IReadOnlyCollection<ProjectEntity> Items, int TotalCount)> GetProjectsAsync(ProjectQueryParameters query, CancellationToken cancellationToken = default)
    {
        var parameters = new DynamicParameters();
        var whereClause = BuildProjectWhere(query, parameters);

        parameters.Add("Offset", RepositoryPaging.GetOffset(query.Page, query.PageSize));
        parameters.Add("PageSize", RepositoryPaging.NormalizePageSize(query.PageSize));

        var sql = $"""
            SELECT
                p.id AS Id,
                p.title AS Title,
                p.document_number AS DocumentNumber,
                p.description AS Description,
                p.type AS Type,
                p.status AS Status,
                p.priority AS Priority,
                p.project_manager_id AS ProjectManagerId,
                pm.name AS ProjectManagerName,
                p.responsible_department_id AS ResponsibleDepartmentId,
                rd.name AS ResponsibleDepartmentName,
                rd.color AS ResponsibleDepartmentColor,
                p.beneficiary_department_id AS BeneficiaryDepartmentId,
                bd.name AS BeneficiaryDepartmentName,
                p.budget AS Budget,
                p.actual_cost AS ActualCost,
                p.start_date AS StartDate,
                p.end_date AS EndDate,
                p.created_at AS CreatedAt,
                p.updated_at AS UpdatedAt,
                (SELECT COUNT(1) FROM dbo.Tasks t WHERE t.project_id = p.id) AS TotalTasks,
                (SELECT COUNT(1) FROM dbo.Tasks t WHERE t.project_id = p.id AND t.status = N'Done') AS CompletedTasks,
                (SELECT COUNT(1) FROM dbo.Tasks t WHERE t.project_id = p.id AND t.status = N'Blocked') AS BlockedTasks,
                (SELECT COUNT(1) FROM dbo.ProjectMembers m WHERE m.project_id = p.id) AS TeamSize
            FROM dbo.Projects p
            INNER JOIN dbo.Users pm ON pm.id = p.project_manager_id
            INNER JOIN dbo.Departments rd ON rd.id = p.responsible_department_id
            INNER JOIN dbo.Departments bd ON bd.id = p.beneficiary_department_id
            {whereClause}
            ORDER BY p.updated_at DESC
            OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;

            SELECT COUNT(1)
            FROM dbo.Projects p
            {whereClause};
            """;

        using var connection = connectionFactory.CreateConnection();
        using var multi = await connection.QueryMultipleAsync(new CommandDefinition(sql, parameters, cancellationToken: cancellationToken));
        var items = (await multi.ReadAsync<ProjectEntity>()).AsList();
        var totalCount = await multi.ReadSingleAsync<int>();
        return (items, totalCount);
    }

    public async Task<ProjectEntity?> GetProjectByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT
                p.id AS Id,
                p.title AS Title,
                p.document_number AS DocumentNumber,
                p.description AS Description,
                p.type AS Type,
                p.status AS Status,
                p.priority AS Priority,
                p.project_manager_id AS ProjectManagerId,
                pm.name AS ProjectManagerName,
                p.responsible_department_id AS ResponsibleDepartmentId,
                rd.name AS ResponsibleDepartmentName,
                rd.color AS ResponsibleDepartmentColor,
                p.beneficiary_department_id AS BeneficiaryDepartmentId,
                bd.name AS BeneficiaryDepartmentName,
                p.budget AS Budget,
                p.actual_cost AS ActualCost,
                p.start_date AS StartDate,
                p.end_date AS EndDate,
                p.created_at AS CreatedAt,
                p.updated_at AS UpdatedAt,
                (SELECT COUNT(1) FROM dbo.Tasks t WHERE t.project_id = p.id) AS TotalTasks,
                (SELECT COUNT(1) FROM dbo.Tasks t WHERE t.project_id = p.id AND t.status = N'Done') AS CompletedTasks,
                (SELECT COUNT(1) FROM dbo.Tasks t WHERE t.project_id = p.id AND t.status = N'Blocked') AS BlockedTasks,
                (SELECT COUNT(1) FROM dbo.ProjectMembers m WHERE m.project_id = p.id) AS TeamSize
            FROM dbo.Projects p
            INNER JOIN dbo.Users pm ON pm.id = p.project_manager_id
            INNER JOIN dbo.Departments rd ON rd.id = p.responsible_department_id
            INNER JOIN dbo.Departments bd ON bd.id = p.beneficiary_department_id
            WHERE p.id = @Id;
            """;

        using var connection = connectionFactory.CreateConnection();
        return await connection.QuerySingleOrDefaultAsync<ProjectEntity>(new CommandDefinition(sql, new { Id = id }, cancellationToken: cancellationToken));
    }

    public async Task<int> CreateProjectAsync(ProjectEntity project, CancellationToken cancellationToken = default)
    {
        const string sql = """
            INSERT INTO dbo.Projects (
                title, document_number, description, type, status, priority, project_manager_id,
                responsible_department_id, beneficiary_department_id, budget, actual_cost,
                start_date, end_date, created_at, updated_at
            )
            VALUES (
                @Title, @DocumentNumber, @Description, @Type, @Status, @Priority, @ProjectManagerId,
                @ResponsibleDepartmentId, @BeneficiaryDepartmentId, @Budget, @ActualCost,
                @StartDate, @EndDate, @CreatedAt, @UpdatedAt
            );

            SELECT CAST(SCOPE_IDENTITY() AS INT);
            """;

        using var connection = connectionFactory.CreateConnection();
        return await connection.ExecuteScalarAsync<int>(new CommandDefinition(sql, project, cancellationToken: cancellationToken));
    }

    public async Task<bool> UpdateProjectAsync(ProjectEntity project, CancellationToken cancellationToken = default)
    {
        const string sql = """
            UPDATE dbo.Projects
            SET
                title = @Title,
                document_number = @DocumentNumber,
                description = @Description,
                type = @Type,
                status = @Status,
                priority = @Priority,
                project_manager_id = @ProjectManagerId,
                responsible_department_id = @ResponsibleDepartmentId,
                beneficiary_department_id = @BeneficiaryDepartmentId,
                budget = @Budget,
                actual_cost = @ActualCost,
                start_date = @StartDate,
                end_date = @EndDate,
                updated_at = @UpdatedAt
            WHERE id = @Id;
            """;

        using var connection = connectionFactory.CreateConnection();
        var affectedRows = await connection.ExecuteAsync(new CommandDefinition(sql, project, cancellationToken: cancellationToken));
        return affectedRows > 0;
    }

    public async Task<bool> DeleteProjectAsync(int id, CancellationToken cancellationToken = default)
    {
        const string sql = "DELETE FROM dbo.Projects WHERE id = @Id;";
        using var connection = connectionFactory.CreateConnection();
        var affectedRows = await connection.ExecuteAsync(new CommandDefinition(sql, new { Id = id }, cancellationToken: cancellationToken));
        return affectedRows > 0;
    }

    public async Task<IReadOnlyCollection<ProjectMemberEntity>> GetProjectMembersAsync(int projectId, CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT
                pm.id AS Id,
                pm.project_id AS ProjectId,
                pm.user_id AS UserId,
                pm.role_in_project AS RoleInProject,
                pm.joined_at AS JoinedAt,
                u.name AS UserName,
                u.email AS UserEmail,
                u.avatar AS UserAvatar
            FROM dbo.ProjectMembers pm
            INNER JOIN dbo.Users u ON u.id = pm.user_id
            WHERE pm.project_id = @ProjectId
            ORDER BY pm.joined_at ASC;
            """;

        using var connection = connectionFactory.CreateConnection();
        return (await connection.QueryAsync<ProjectMemberEntity>(new CommandDefinition(sql, new { ProjectId = projectId }, cancellationToken: cancellationToken))).AsList();
    }

    public async Task<int> AddProjectMemberAsync(int projectId, int userId, string roleInProject, CancellationToken cancellationToken = default)
    {
        const string sql = """
            INSERT INTO dbo.ProjectMembers (project_id, user_id, role_in_project)
            VALUES (@ProjectId, @UserId, @RoleInProject);

            SELECT CAST(SCOPE_IDENTITY() AS INT);
            """;

        using var connection = connectionFactory.CreateConnection();
        return await connection.ExecuteScalarAsync<int>(new CommandDefinition(sql, new { ProjectId = projectId, UserId = userId, RoleInProject = roleInProject }, cancellationToken: cancellationToken));
    }

    public async Task<bool> RemoveProjectMemberAsync(int projectId, int userId, CancellationToken cancellationToken = default)
    {
        const string sql = "DELETE FROM dbo.ProjectMembers WHERE project_id = @ProjectId AND user_id = @UserId;";
        using var connection = connectionFactory.CreateConnection();
        var affectedRows = await connection.ExecuteAsync(new CommandDefinition(sql, new { ProjectId = projectId, UserId = userId }, cancellationToken: cancellationToken));
        return affectedRows > 0;
    }

    public async Task<(ProjectSummaryEntity? Summary, IReadOnlyCollection<ExecutiveUpdateEntity> Updates)> GetProjectSummaryAsync(int projectId, CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT
                p.id AS ProjectId,
                CAST(
                    CASE WHEN (SELECT COUNT(1) FROM dbo.Tasks t WHERE t.project_id = p.id) = 0
                    THEN 0
                    ELSE (100.0 * (SELECT COUNT(1) FROM dbo.Tasks t WHERE t.project_id = p.id AND t.status = N'Done')
                        / NULLIF((SELECT COUNT(1) FROM dbo.Tasks t WHERE t.project_id = p.id), 0))
                    END AS DECIMAL(5,2)
                ) AS CompletionPercent,
                (SELECT COUNT(1) FROM dbo.Tasks t WHERE t.project_id = p.id) AS TotalTasks,
                (SELECT COUNT(1) FROM dbo.Tasks t WHERE t.project_id = p.id AND t.status = N'Done') AS DoneTasks,
                (SELECT COUNT(1) FROM dbo.Tasks t WHERE t.project_id = p.id AND t.status = N'InProgress') AS InProgressTasks,
                (SELECT COUNT(1) FROM dbo.Tasks t WHERE t.project_id = p.id AND t.status = N'Blocked') AS BlockedTasks,
                p.budget AS Budget,
                p.actual_cost AS ActualCost,
                (p.actual_cost - p.budget) AS Variance,
                (SELECT COUNT(1) FROM dbo.ProjectMembers m WHERE m.project_id = p.id) AS TeamSize
            FROM dbo.Projects p
            WHERE p.id = @ProjectId;

            SELECT TOP (5)
                eu.id AS Id,
                eu.project_id AS ProjectId,
                eu.title AS Title,
                eu.content AS Content,
                eu.update_type AS UpdateType,
                eu.created_by_id AS CreatedById,
                u.name AS CreatedByName,
                eu.created_at AS CreatedAt
            FROM dbo.ExecutiveUpdates eu
            INNER JOIN dbo.Users u ON u.id = eu.created_by_id
            WHERE eu.project_id = @ProjectId
            ORDER BY eu.created_at DESC;
            """;

        using var connection = connectionFactory.CreateConnection();
        using var multi = await connection.QueryMultipleAsync(new CommandDefinition(sql, new { ProjectId = projectId }, cancellationToken: cancellationToken));
        var summary = await multi.ReadSingleOrDefaultAsync<ProjectSummaryEntity>();
        var updates = (await multi.ReadAsync<ExecutiveUpdateEntity>()).AsList();
        return (summary, updates);
    }

    public async Task<IReadOnlyCollection<ProjectEntity>> GetTimelineAsync(TimelineQueryParameters query, CancellationToken cancellationToken = default)
    {
        var parameters = new DynamicParameters();
        var conditions = new List<string>
        {
            "YEAR(p.start_date) <= @Year",
            "YEAR(p.end_date) >= @Year"
        };

        parameters.Add("Year", query.Year);

        if (!string.IsNullOrWhiteSpace(query.Type))
        {
            conditions.Add("p.type = @Type");
            parameters.Add("Type", query.Type.Trim());
        }

        if (!string.IsNullOrWhiteSpace(query.Status))
        {
            conditions.Add("p.status = @Status");
            parameters.Add("Status", query.Status.Trim());
        }

        if (query.DepartmentId is > 0)
        {
            conditions.Add("(p.responsible_department_id = @DepartmentId OR p.beneficiary_department_id = @DepartmentId)");
            parameters.Add("DepartmentId", query.DepartmentId);
        }

        var sql = $"""
            SELECT
                p.id AS Id,
                p.title AS Title,
                p.description AS Description,
                p.type AS Type,
                p.status AS Status,
                p.priority AS Priority,
                p.project_manager_id AS ProjectManagerId,
                pm.name AS ProjectManagerName,
                p.responsible_department_id AS ResponsibleDepartmentId,
                rd.name AS ResponsibleDepartmentName,
                rd.color AS ResponsibleDepartmentColor,
                p.beneficiary_department_id AS BeneficiaryDepartmentId,
                bd.name AS BeneficiaryDepartmentName,
                p.budget AS Budget,
                p.actual_cost AS ActualCost,
                p.start_date AS StartDate,
                p.end_date AS EndDate,
                p.created_at AS CreatedAt,
                p.updated_at AS UpdatedAt,
                (SELECT COUNT(1) FROM dbo.Tasks t WHERE t.project_id = p.id) AS TotalTasks,
                (SELECT COUNT(1) FROM dbo.Tasks t WHERE t.project_id = p.id AND t.status = N'Done') AS CompletedTasks,
                (SELECT COUNT(1) FROM dbo.Tasks t WHERE t.project_id = p.id AND t.status = N'Blocked') AS BlockedTasks,
                (SELECT COUNT(1) FROM dbo.ProjectMembers m WHERE m.project_id = p.id) AS TeamSize
            FROM dbo.Projects p
            INNER JOIN dbo.Users pm ON pm.id = p.project_manager_id
            INNER JOIN dbo.Departments rd ON rd.id = p.responsible_department_id
            INNER JOIN dbo.Departments bd ON bd.id = p.beneficiary_department_id
            WHERE {string.Join(" AND ", conditions)}
            ORDER BY p.start_date ASC;
            """;

        using var connection = connectionFactory.CreateConnection();
        return (await connection.QueryAsync<ProjectEntity>(new CommandDefinition(sql, parameters, cancellationToken: cancellationToken))).AsList();
    }

    public async Task<DashboardStatsEntity> GetDashboardStatsAsync(CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT COUNT(1) FROM dbo.Projects WHERE status = N'Active';
            SELECT COUNT(1) FROM dbo.Tasks WHERE status <> N'Done' AND due_date < SYSUTCDATETIME();
            SELECT COUNT(1) FROM dbo.Licenses WHERE expiry_date < SYSUTCDATETIME();

            SELECT
                p.type AS Label,
                COUNT(1) AS Value,
                CASE p.type
                    WHEN N'Software' THEN N'#818CF8'
                    WHEN N'Networks' THEN N'#38BDF8'
                    WHEN N'Cybersecurity' THEN N'#34D399'
                    WHEN N'Maintenance' THEN N'#FB923C'
                    ELSE N'#6366F1'
                END AS Color
            FROM dbo.Projects p
            GROUP BY p.type;

            SELECT
                p.status AS Label,
                COUNT(1) AS Value,
                CASE p.status
                    WHEN N'Planning' THEN N'#0EA5E9'
                    WHEN N'Active' THEN N'#10B981'
                    WHEN N'OnHold' THEN N'#F59E0B'
                    WHEN N'Completed' THEN N'#6366F1'
                    WHEN N'Cancelled' THEN N'#EF4444'
                    ELSE N'#94A3B8'
                END AS Color
            FROM dbo.Projects p
            GROUP BY p.status;

            SELECT TOP (8)
                eu.id AS Id,
                eu.project_id AS ProjectId,
                eu.title AS Title,
                eu.content AS Content,
                eu.update_type AS UpdateType,
                eu.created_by_id AS CreatedById,
                u.name AS CreatedByName,
                eu.created_at AS CreatedAt
            FROM dbo.ExecutiveUpdates eu
            INNER JOIN dbo.Users u ON u.id = eu.created_by_id
            ORDER BY eu.created_at DESC;

            SELECT TOP (10)
                l.id AS Id,
                l.name AS Name,
                l.type AS Type,
                l.key_value AS KeyValue,
                l.vendor AS Vendor,
                l.purchase_date AS PurchaseDate,
                l.expiry_date AS ExpiryDate,
                l.cost AS Cost,
                l.renewal_reminder_days AS RenewalReminderDays,
                l.project_id AS ProjectId,
                p.title AS ProjectTitle,
                l.notes AS Notes,
                l.status AS Status,
                DATEDIFF(DAY, CAST(SYSUTCDATETIME() AS DATE), CAST(l.expiry_date AS DATE)) AS DaysUntilExpiry
            FROM dbo.Licenses l
            LEFT JOIN dbo.Projects p ON p.id = l.project_id
            WHERE l.expiry_date <= DATEADD(DAY, 30, SYSUTCDATETIME())
            ORDER BY l.expiry_date ASC;
            """;

        using var connection = connectionFactory.CreateConnection();
        using var multi = await connection.QueryMultipleAsync(new CommandDefinition(sql, cancellationToken: cancellationToken));

        return new DashboardStatsEntity
        {
            ActiveProjects = await multi.ReadSingleAsync<int>(),
            OverdueTasks = await multi.ReadSingleAsync<int>(),
            ExpiredLicenses = await multi.ReadSingleAsync<int>(),
            ProjectsByType = (await multi.ReadAsync<ChartSliceEntity>()).AsList(),
            ProjectsByStatus = (await multi.ReadAsync<ChartSliceEntity>()).AsList(),
            RecentUpdates = (await multi.ReadAsync<ExecutiveUpdateEntity>()).AsList(),
            ExpiringLicenses = (await multi.ReadAsync<LicenseEntity>()).AsList()
        };
    }

    public async Task<bool> HasProjectAccessAsync(int projectId, int userId, string role, bool writeAccess, CancellationToken cancellationToken = default)
    {
        if (role == SystemRoles.Admin)
        {
            return true;
        }

        if (SystemRoles.GlobalReadRoles.Contains(role))
        {
            return !writeAccess;
        }

        const string departmentScopedSql = """
            SELECT COUNT(1)
            FROM dbo.Projects p
            INNER JOIN dbo.Users u ON u.id = @UserId
            WHERE p.id = @ProjectId
              AND u.department_id IS NOT NULL
              AND (p.responsible_department_id = u.department_id OR p.beneficiary_department_id = u.department_id);
            """;
        const string managerSql = "SELECT COUNT(1) FROM dbo.Projects WHERE id = @ProjectId AND project_manager_id = @UserId;";
        const string memberSql = """
            SELECT COUNT(1)
            FROM dbo.ProjectMembers pm
            WHERE pm.project_id = @ProjectId AND pm.user_id = @UserId;
            """;

        using var connection = connectionFactory.CreateConnection();
        if (!writeAccess && (SystemRoles.DepartmentScopedRoles.Contains(role) || role == SystemRoles.DivisionMember))
        {
            return await connection.ExecuteScalarAsync<int>(new CommandDefinition(departmentScopedSql, new { ProjectId = projectId, UserId = userId }, cancellationToken: cancellationToken)) > 0;
        }

        if (role == SystemRoles.ProjectManager)
        {
            return await connection.ExecuteScalarAsync<int>(new CommandDefinition(managerSql, new { ProjectId = projectId, UserId = userId }, cancellationToken: cancellationToken)) > 0;
        }

        if (!writeAccess)
        {
            var memberCount = await connection.ExecuteScalarAsync<int>(new CommandDefinition(memberSql, new { ProjectId = projectId, UserId = userId }, cancellationToken: cancellationToken));
            if (memberCount > 0)
            {
                return true;
            }

            const string assignedSql = """
                SELECT COUNT(1)
                FROM dbo.Tasks t
                LEFT JOIN dbo.TaskAssignees ta ON ta.task_id = t.id
                WHERE t.project_id = @ProjectId
                  AND (t.assigned_to_id = @UserId OR ta.user_id = @UserId);
                """;

            return await connection.ExecuteScalarAsync<int>(new CommandDefinition(assignedSql, new { ProjectId = projectId, UserId = userId }, cancellationToken: cancellationToken)) > 0;
        }

        return false;
    }

    private static string BuildProjectWhere(ProjectQueryParameters query, DynamicParameters parameters)
    {
        var conditions = new List<string>();

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            conditions.Add("(p.title LIKE @Search OR p.description LIKE @Search)");
            parameters.Add("Search", $"%{query.Search.Trim()}%");
        }

        if (!string.IsNullOrWhiteSpace(query.Type))
        {
            conditions.Add("p.type = @Type");
            parameters.Add("Type", query.Type.Trim());
        }

        if (!string.IsNullOrWhiteSpace(query.Status))
        {
            conditions.Add("p.status = @Status");
            parameters.Add("Status", query.Status.Trim());
        }

        if (!string.IsNullOrWhiteSpace(query.Priority))
        {
            conditions.Add("p.priority = @Priority");
            parameters.Add("Priority", query.Priority.Trim());
        }

        if (query.ProjectManagerId is > 0)
        {
            conditions.Add("p.project_manager_id = @ProjectManagerId");
            parameters.Add("ProjectManagerId", query.ProjectManagerId);
        }

        if (query.DepartmentId is > 0)
        {
            conditions.Add("(p.responsible_department_id = @DepartmentId OR p.beneficiary_department_id = @DepartmentId)");
            parameters.Add("DepartmentId", query.DepartmentId);
        }

        if (query.MemberUserId is > 0)
        {
            conditions.Add("""
                (
                    EXISTS (SELECT 1 FROM dbo.ProjectMembers pm WHERE pm.project_id = p.id AND pm.user_id = @MemberUserId)
                    OR EXISTS (SELECT 1 FROM dbo.Tasks t WHERE t.project_id = p.id AND t.assigned_to_id = @MemberUserId)
                )
                """);
            parameters.Add("MemberUserId", query.MemberUserId);
        }

        return conditions.Count == 0 ? string.Empty : $"WHERE {string.Join(" AND ", conditions)}";
    }
}

public sealed class TaskRepository(ISqlConnectionFactory connectionFactory) : ITaskRepository
{
    public async Task<IReadOnlyCollection<ProjectTaskEntity>> GetProjectTasksAsync(int projectId, CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT
                t.id AS Id,
                t.project_id AS ProjectId,
                t.title AS Title,
                t.description AS Description,
                t.assigned_to_id AS AssignedToId,
                assigned.name AS AssignedToName,
                t.created_by_id AS CreatedById,
                creator.name AS CreatedByName,
                t.status AS Status,
                t.priority AS Priority,
                t.due_date AS DueDate,
                t.estimated_hours AS EstimatedHours,
                t.actual_hours AS ActualHours,
                t.order_index AS OrderIndex,
                t.created_at AS CreatedAt
            FROM dbo.Tasks t
            INNER JOIN dbo.Users creator ON creator.id = t.created_by_id
            LEFT JOIN dbo.Users assigned ON assigned.id = t.assigned_to_id
            WHERE t.project_id = @ProjectId
            ORDER BY t.order_index ASC, t.created_at ASC;

            SELECT
                ta.task_id AS TaskId,
                u.id AS UserId,
                u.name AS UserName,
                u.email AS UserEmail,
                u.avatar AS UserAvatar
            FROM dbo.TaskAssignees ta
            INNER JOIN dbo.Tasks t ON t.id = ta.task_id
            INNER JOIN dbo.Users u ON u.id = ta.user_id
            WHERE t.project_id = @ProjectId
            ORDER BY u.name ASC;
            """;

        using var connection = connectionFactory.CreateConnection();
        using var multi = await connection.QueryMultipleAsync(new CommandDefinition(sql, new { ProjectId = projectId }, cancellationToken: cancellationToken));
        var tasks = (await multi.ReadAsync<ProjectTaskEntity>()).AsList();
        var assignees = (await multi.ReadAsync<TaskAssigneeEntity>()).AsList();
        var assigneesByTask = assignees.GroupBy(static assignee => assignee.TaskId).ToDictionary(static group => group.Key, static group => (IReadOnlyCollection<TaskAssigneeEntity>)group.ToArray());

        foreach (var task in tasks)
        {
            if (assigneesByTask.TryGetValue(task.Id, out var taskAssignees))
            {
                task.Assignees = taskAssignees;
            }
        }

        return tasks;
    }

    public async Task<ProjectTaskEntity?> GetTaskByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT
                t.id AS Id,
                t.project_id AS ProjectId,
                t.title AS Title,
                t.description AS Description,
                t.assigned_to_id AS AssignedToId,
                assigned.name AS AssignedToName,
                t.created_by_id AS CreatedById,
                creator.name AS CreatedByName,
                t.status AS Status,
                t.priority AS Priority,
                t.due_date AS DueDate,
                t.estimated_hours AS EstimatedHours,
                t.actual_hours AS ActualHours,
                t.order_index AS OrderIndex,
                t.created_at AS CreatedAt
            FROM dbo.Tasks t
            INNER JOIN dbo.Users creator ON creator.id = t.created_by_id
            LEFT JOIN dbo.Users assigned ON assigned.id = t.assigned_to_id
            WHERE t.id = @Id;

            SELECT
                ta.task_id AS TaskId,
                u.id AS UserId,
                u.name AS UserName,
                u.email AS UserEmail,
                u.avatar AS UserAvatar
            FROM dbo.TaskAssignees ta
            INNER JOIN dbo.Users u ON u.id = ta.user_id
            WHERE ta.task_id = @Id
            ORDER BY u.name ASC;
            """;

        using var connection = connectionFactory.CreateConnection();
        using var multi = await connection.QueryMultipleAsync(new CommandDefinition(sql, new { Id = id }, cancellationToken: cancellationToken));
        var task = await multi.ReadSingleOrDefaultAsync<ProjectTaskEntity>();
        if (task is null)
        {
            return null;
        }

        task.Assignees = (await multi.ReadAsync<TaskAssigneeEntity>()).AsList();
        return task;
    }

    public async Task<int> CreateTaskAsync(ProjectTaskEntity task, CancellationToken cancellationToken = default)
    {
        const string sql = """
            INSERT INTO dbo.Tasks (
                project_id, title, description, assigned_to_id, created_by_id,
                status, priority, due_date, estimated_hours, actual_hours, order_index, created_at
            )
            VALUES (
                @ProjectId, @Title, @Description, @AssignedToId, @CreatedById,
                @Status, @Priority, @DueDate, @EstimatedHours, @ActualHours, @OrderIndex, @CreatedAt
            );

            SELECT CAST(SCOPE_IDENTITY() AS INT);
            """;

        using var connection = connectionFactory.CreateConnection();
        connection.Open();
        using var transaction = connection.BeginTransaction();
        var taskId = await connection.ExecuteScalarAsync<int>(new CommandDefinition(sql, task, transaction, cancellationToken: cancellationToken));
        await ReplaceTaskAssigneesAsync(connection, transaction, taskId, task.AssignedUserIds, cancellationToken);
        transaction.Commit();
        return taskId;
    }

    public async Task<bool> UpdateTaskAsync(ProjectTaskEntity task, CancellationToken cancellationToken = default)
    {
        const string sql = """
            UPDATE dbo.Tasks
            SET
                title = @Title,
                description = @Description,
                assigned_to_id = @AssignedToId,
                status = @Status,
                priority = @Priority,
                due_date = @DueDate,
                estimated_hours = @EstimatedHours,
                actual_hours = @ActualHours,
                order_index = @OrderIndex
            WHERE id = @Id;
            """;

        using var connection = connectionFactory.CreateConnection();
        connection.Open();
        using var transaction = connection.BeginTransaction();
        var updated = await connection.ExecuteAsync(new CommandDefinition(sql, task, transaction, cancellationToken: cancellationToken)) > 0;
        if (updated)
        {
            await ReplaceTaskAssigneesAsync(connection, transaction, task.Id, task.AssignedUserIds, cancellationToken);
        }

        transaction.Commit();
        return updated;
    }

    public async Task<bool> UpdateTaskStatusAsync(int id, string status, CancellationToken cancellationToken = default)
    {
        const string sql = "UPDATE dbo.Tasks SET status = @Status WHERE id = @Id;";
        using var connection = connectionFactory.CreateConnection();
        return await connection.ExecuteAsync(new CommandDefinition(sql, new { Id = id, Status = status }, cancellationToken: cancellationToken)) > 0;
    }

    public async Task<bool> DeleteTaskAsync(int id, CancellationToken cancellationToken = default)
    {
        const string sql = "DELETE FROM dbo.Tasks WHERE id = @Id;";
        using var connection = connectionFactory.CreateConnection();
        return await connection.ExecuteAsync(new CommandDefinition(sql, new { Id = id }, cancellationToken: cancellationToken)) > 0;
    }

    private static async Task ReplaceTaskAssigneesAsync(
        System.Data.IDbConnection connection,
        System.Data.IDbTransaction transaction,
        int taskId,
        IReadOnlyCollection<int> assignedUserIds,
        CancellationToken cancellationToken)
    {
        const string deleteSql = "DELETE FROM dbo.TaskAssignees WHERE task_id = @TaskId;";
        await connection.ExecuteAsync(new CommandDefinition(deleteSql, new { TaskId = taskId }, transaction, cancellationToken: cancellationToken));

        var userIds = assignedUserIds.Distinct().ToArray();
        if (userIds.Length == 0)
        {
            return;
        }

        const string insertSql = """
            INSERT INTO dbo.TaskAssignees (task_id, user_id)
            VALUES (@TaskId, @UserId);
            """;

        var rows = userIds.Select(userId => new { TaskId = taskId, UserId = userId });
        await connection.ExecuteAsync(new CommandDefinition(insertSql, rows, transaction, cancellationToken: cancellationToken));
    }
}

public sealed class ExecutiveUpdateRepository(ISqlConnectionFactory connectionFactory) : IExecutiveUpdateRepository
{
    public async Task<IReadOnlyCollection<ExecutiveUpdateEntity>> GetProjectUpdatesAsync(int projectId, CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT
                eu.id AS Id,
                eu.project_id AS ProjectId,
                eu.title AS Title,
                eu.content AS Content,
                eu.update_type AS UpdateType,
                eu.created_by_id AS CreatedById,
                u.name AS CreatedByName,
                eu.created_at AS CreatedAt
            FROM dbo.ExecutiveUpdates eu
            INNER JOIN dbo.Users u ON u.id = eu.created_by_id
            WHERE eu.project_id = @ProjectId
            ORDER BY eu.created_at DESC;
            """;

        using var connection = connectionFactory.CreateConnection();
        return (await connection.QueryAsync<ExecutiveUpdateEntity>(new CommandDefinition(sql, new { ProjectId = projectId }, cancellationToken: cancellationToken))).AsList();
    }

    public async Task<IReadOnlyCollection<ExecutiveUpdateEntity>> GetRecentUpdatesAsync(int take = 10, CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT TOP (@Take)
                eu.id AS Id,
                eu.project_id AS ProjectId,
                eu.title AS Title,
                eu.content AS Content,
                eu.update_type AS UpdateType,
                eu.created_by_id AS CreatedById,
                u.name AS CreatedByName,
                eu.created_at AS CreatedAt
            FROM dbo.ExecutiveUpdates eu
            INNER JOIN dbo.Users u ON u.id = eu.created_by_id
            ORDER BY eu.created_at DESC;
            """;

        using var connection = connectionFactory.CreateConnection();
        return (await connection.QueryAsync<ExecutiveUpdateEntity>(new CommandDefinition(sql, new { Take = take }, cancellationToken: cancellationToken))).AsList();
    }

    public async Task<int> CreateUpdateAsync(ExecutiveUpdateEntity update, CancellationToken cancellationToken = default)
    {
        const string sql = """
            INSERT INTO dbo.ExecutiveUpdates (project_id, title, content, update_type, created_by_id, created_at)
            VALUES (@ProjectId, @Title, @Content, @UpdateType, @CreatedById, @CreatedAt);

            SELECT CAST(SCOPE_IDENTITY() AS INT);
            """;

        using var connection = connectionFactory.CreateConnection();
        return await connection.ExecuteScalarAsync<int>(new CommandDefinition(sql, update, cancellationToken: cancellationToken));
    }

    public async Task<bool> DeleteUpdateAsync(int projectId, int updateId, CancellationToken cancellationToken = default)
    {
        const string sql = "DELETE FROM dbo.ExecutiveUpdates WHERE id = @UpdateId AND project_id = @ProjectId;";

        using var connection = connectionFactory.CreateConnection();
        var rows = await connection.ExecuteAsync(new CommandDefinition(sql, new { ProjectId = projectId, UpdateId = updateId }, cancellationToken: cancellationToken));
        return rows > 0;
    }
}

public sealed class LicenseRepository(ISqlConnectionFactory connectionFactory) : ILicenseRepository
{
    public async Task<(IReadOnlyCollection<LicenseEntity> Items, int TotalCount)> GetLicensesAsync(LicenseQueryParameters query, CancellationToken cancellationToken = default)
    {
        var parameters = new DynamicParameters();
        var whereClause = BuildLicenseWhere(query, parameters);

        parameters.Add("Offset", RepositoryPaging.GetOffset(query.Page, query.PageSize));
        parameters.Add("PageSize", RepositoryPaging.NormalizePageSize(query.PageSize));

        var sql = $"""
            SELECT
                l.id AS Id,
                l.name AS Name,
                l.type AS Type,
                l.key_value AS KeyValue,
                l.vendor AS Vendor,
                l.purchase_date AS PurchaseDate,
                l.expiry_date AS ExpiryDate,
                l.cost AS Cost,
                l.renewal_reminder_days AS RenewalReminderDays,
                l.project_id AS ProjectId,
                p.title AS ProjectTitle,
                l.notes AS Notes,
                l.status AS Status,
                DATEDIFF(DAY, CAST(SYSUTCDATETIME() AS DATE), CAST(l.expiry_date AS DATE)) AS DaysUntilExpiry
            FROM dbo.Licenses l
            LEFT JOIN dbo.Projects p ON p.id = l.project_id
            {whereClause}
            ORDER BY l.expiry_date ASC
            OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;

            SELECT COUNT(1)
            FROM dbo.Licenses l
            LEFT JOIN dbo.Projects p ON p.id = l.project_id
            {whereClause};
            """;

        using var connection = connectionFactory.CreateConnection();
        using var multi = await connection.QueryMultipleAsync(new CommandDefinition(sql, parameters, cancellationToken: cancellationToken));
        var items = (await multi.ReadAsync<LicenseEntity>()).AsList();
        var totalCount = await multi.ReadSingleAsync<int>();
        return (items, totalCount);
    }

    public async Task<IReadOnlyCollection<LicenseEntity>> GetExpiringSoonAsync(int days, CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT
                l.id AS Id,
                l.name AS Name,
                l.type AS Type,
                l.key_value AS KeyValue,
                l.vendor AS Vendor,
                l.purchase_date AS PurchaseDate,
                l.expiry_date AS ExpiryDate,
                l.cost AS Cost,
                l.renewal_reminder_days AS RenewalReminderDays,
                l.project_id AS ProjectId,
                p.title AS ProjectTitle,
                l.notes AS Notes,
                l.status AS Status,
                DATEDIFF(DAY, CAST(SYSUTCDATETIME() AS DATE), CAST(l.expiry_date AS DATE)) AS DaysUntilExpiry
            FROM dbo.Licenses l
            LEFT JOIN dbo.Projects p ON p.id = l.project_id
            WHERE l.expiry_date <= DATEADD(DAY, @Days, SYSUTCDATETIME())
            ORDER BY l.expiry_date ASC;
            """;

        using var connection = connectionFactory.CreateConnection();
        return (await connection.QueryAsync<LicenseEntity>(new CommandDefinition(sql, new { Days = days }, cancellationToken: cancellationToken))).AsList();
    }

    public async Task<LicenseEntity?> GetByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT
                l.id AS Id,
                l.name AS Name,
                l.type AS Type,
                l.key_value AS KeyValue,
                l.vendor AS Vendor,
                l.purchase_date AS PurchaseDate,
                l.expiry_date AS ExpiryDate,
                l.cost AS Cost,
                l.renewal_reminder_days AS RenewalReminderDays,
                l.project_id AS ProjectId,
                p.title AS ProjectTitle,
                l.notes AS Notes,
                l.status AS Status,
                DATEDIFF(DAY, CAST(SYSUTCDATETIME() AS DATE), CAST(l.expiry_date AS DATE)) AS DaysUntilExpiry
            FROM dbo.Licenses l
            LEFT JOIN dbo.Projects p ON p.id = l.project_id
            WHERE l.id = @Id;
            """;

        using var connection = connectionFactory.CreateConnection();
        return await connection.QuerySingleOrDefaultAsync<LicenseEntity>(new CommandDefinition(sql, new { Id = id }, cancellationToken: cancellationToken));
    }

    public async Task<int> CreateAsync(LicenseEntity license, CancellationToken cancellationToken = default)
    {
        const string sql = """
            INSERT INTO dbo.Licenses (
                name, type, key_value, vendor, purchase_date, expiry_date,
                cost, renewal_reminder_days, project_id, notes, status
            )
            VALUES (
                @Name, @Type, @KeyValue, @Vendor, @PurchaseDate, @ExpiryDate,
                @Cost, @RenewalReminderDays, @ProjectId, @Notes, @Status
            );

            SELECT CAST(SCOPE_IDENTITY() AS INT);
            """;

        using var connection = connectionFactory.CreateConnection();
        return await connection.ExecuteScalarAsync<int>(new CommandDefinition(sql, license, cancellationToken: cancellationToken));
    }

    public async Task<bool> UpdateAsync(LicenseEntity license, CancellationToken cancellationToken = default)
    {
        const string sql = """
            UPDATE dbo.Licenses
            SET
                name = @Name,
                type = @Type,
                key_value = @KeyValue,
                vendor = @Vendor,
                purchase_date = @PurchaseDate,
                expiry_date = @ExpiryDate,
                cost = @Cost,
                renewal_reminder_days = @RenewalReminderDays,
                project_id = @ProjectId,
                notes = @Notes,
                status = @Status
            WHERE id = @Id;
            """;

        using var connection = connectionFactory.CreateConnection();
        return await connection.ExecuteAsync(new CommandDefinition(sql, license, cancellationToken: cancellationToken)) > 0;
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken cancellationToken = default)
    {
        const string sql = "DELETE FROM dbo.Licenses WHERE id = @Id;";
        using var connection = connectionFactory.CreateConnection();
        return await connection.ExecuteAsync(new CommandDefinition(sql, new { Id = id }, cancellationToken: cancellationToken)) > 0;
    }

    private static string BuildLicenseWhere(LicenseQueryParameters query, DynamicParameters parameters)
    {
        var conditions = new List<string>();
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            conditions.Add("(l.name LIKE @Search OR l.vendor LIKE @Search OR p.title LIKE @Search)");
            parameters.Add("Search", $"%{query.Search.Trim()}%");
        }

        if (!string.IsNullOrWhiteSpace(query.Type))
        {
            conditions.Add("l.type = @Type");
            parameters.Add("Type", query.Type.Trim());
        }

        if (!string.IsNullOrWhiteSpace(query.Status))
        {
            conditions.Add("l.status = @Status");
            parameters.Add("Status", query.Status.Trim());
        }

        if (query.ProjectId is > 0)
        {
            conditions.Add("l.project_id = @ProjectId");
            parameters.Add("ProjectId", query.ProjectId);
        }

        if (query.ExpiringInDays is > 0)
        {
            conditions.Add("l.expiry_date <= DATEADD(DAY, @ExpiringInDays, SYSUTCDATETIME())");
            parameters.Add("ExpiringInDays", query.ExpiringInDays);
        }

        return conditions.Count == 0 ? string.Empty : $"WHERE {string.Join(" AND ", conditions)}";
    }
}

public sealed class NotificationRepository(ISqlConnectionFactory connectionFactory) : INotificationRepository
{
    public async Task<(IReadOnlyCollection<NotificationEntity> Items, int TotalCount)> GetNotificationsAsync(int userId, NotificationQueryParameters query, CancellationToken cancellationToken = default)
    {
        var parameters = new DynamicParameters(new { UserId = userId });
        var whereClause = BuildNotificationWhere(query, parameters);
        parameters.Add("Offset", RepositoryPaging.GetOffset(query.Page, query.PageSize));
        parameters.Add("PageSize", RepositoryPaging.NormalizePageSize(query.PageSize));

        var sql = $"""
            SELECT
                n.id AS Id,
                n.user_id AS UserId,
                n.title AS Title,
                n.message AS Message,
                n.type AS Type,
                n.is_read AS IsRead,
                n.related_entity_type AS RelatedEntityType,
                n.related_entity_id AS RelatedEntityId,
                n.created_at AS CreatedAt
            FROM dbo.Notifications n
            WHERE n.user_id = @UserId {whereClause}
            ORDER BY n.created_at DESC
            OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;

            SELECT COUNT(1)
            FROM dbo.Notifications n
            WHERE n.user_id = @UserId {whereClause};
            """;

        using var connection = connectionFactory.CreateConnection();
        using var multi = await connection.QueryMultipleAsync(new CommandDefinition(sql, parameters, cancellationToken: cancellationToken));
        var items = (await multi.ReadAsync<NotificationEntity>()).AsList();
        var totalCount = await multi.ReadSingleAsync<int>();
        return (items, totalCount);
    }

    public async Task<int> CreateAsync(NotificationEntity notification, CancellationToken cancellationToken = default)
    {
        const string sql = """
            INSERT INTO dbo.Notifications (
                user_id, title, message, type, is_read,
                related_entity_type, related_entity_id, created_at
            )
            VALUES (
                @UserId, @Title, @Message, @Type, @IsRead,
                @RelatedEntityType, @RelatedEntityId, @CreatedAt
            );

            SELECT CAST(SCOPE_IDENTITY() AS INT);
            """;

        using var connection = connectionFactory.CreateConnection();
        return await connection.ExecuteScalarAsync<int>(new CommandDefinition(sql, notification, cancellationToken: cancellationToken));
    }

    public async Task<int> MarkReadAsync(int userId, IReadOnlyCollection<int>? notificationIds, CancellationToken cancellationToken = default)
    {
        using var connection = connectionFactory.CreateConnection();
        if (notificationIds is null || notificationIds.Count == 0)
        {
            const string sqlAll = "UPDATE dbo.Notifications SET is_read = 1 WHERE user_id = @UserId;";
            return await connection.ExecuteAsync(new CommandDefinition(sqlAll, new { UserId = userId }, cancellationToken: cancellationToken));
        }

        const string sql = "UPDATE dbo.Notifications SET is_read = 1 WHERE user_id = @UserId AND id IN @Ids;";
        return await connection.ExecuteAsync(new CommandDefinition(sql, new { UserId = userId, Ids = notificationIds }, cancellationToken: cancellationToken));
    }

    private static string BuildNotificationWhere(NotificationQueryParameters query, DynamicParameters parameters)
    {
        var builder = new StringBuilder();
        if (!string.IsNullOrWhiteSpace(query.Type))
        {
            builder.Append(" AND n.type = @Type");
            parameters.Add("Type", query.Type.Trim());
        }

        if (query.IsRead is not null)
        {
            builder.Append(" AND n.is_read = @IsRead");
            parameters.Add("IsRead", query.IsRead);
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            builder.Append(" AND (n.title LIKE @Search OR n.message LIKE @Search)");
            parameters.Add("Search", $"%{query.Search.Trim()}%");
        }

        return builder.ToString();
    }
}

public sealed class AuthRepository(ISqlConnectionFactory connectionFactory) : IAuthRepository
{
    public async Task<RegisteredDeviceEntity?> GetDeviceByNameAsync(string deviceName, CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT
                rd.id AS Id,
                rd.device_name AS DeviceName,
                rd.user_id AS UserId,
                u.name AS UserName,
                u.email AS UserEmail,
                rd.is_active AS IsActive,
                rd.last_login AS LastLogin,
                rd.registered_at AS RegisteredAt,
                rd.registered_by AS RegisteredBy,
                adminUser.name AS RegisteredByName,
                rd.notes AS Notes
            FROM dbo.RegisteredDevices rd
            INNER JOIN dbo.Users u ON u.id = rd.user_id
            INNER JOIN dbo.Users adminUser ON adminUser.id = rd.registered_by
            WHERE rd.device_name = @DeviceName;
            """;

        using var connection = connectionFactory.CreateConnection();
        return await connection.QuerySingleOrDefaultAsync<RegisteredDeviceEntity>(new CommandDefinition(sql, new { DeviceName = deviceName }, cancellationToken: cancellationToken));
    }

    public async Task UpdateLastLoginAsync(int deviceId, DateTime lastLoginUtc, CancellationToken cancellationToken = default)
    {
        const string sql = "UPDATE dbo.RegisteredDevices SET last_login = @LastLogin WHERE id = @DeviceId;";
        using var connection = connectionFactory.CreateConnection();
        await connection.ExecuteAsync(new CommandDefinition(sql, new { DeviceId = deviceId, LastLogin = lastLoginUtc }, cancellationToken: cancellationToken));
    }

    public async Task AddRefreshTokenAsync(RefreshTokenEntity refreshToken, CancellationToken cancellationToken = default)
    {
        const string sql = """
            INSERT INTO dbo.RefreshTokens (user_id, token, device_name, expires_at, created_at, revoked_at, replaced_by_token)
            VALUES (@UserId, @Token, @DeviceName, @ExpiresAt, @CreatedAt, @RevokedAt, @ReplacedByToken);
            """;

        using var connection = connectionFactory.CreateConnection();
        await connection.ExecuteAsync(new CommandDefinition(sql, refreshToken, cancellationToken: cancellationToken));
    }

    public async Task<RefreshTokenEntity?> GetRefreshTokenAsync(string token, CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT
                id AS Id,
                user_id AS UserId,
                token AS Token,
                device_name AS DeviceName,
                expires_at AS ExpiresAt,
                created_at AS CreatedAt,
                revoked_at AS RevokedAt,
                replaced_by_token AS ReplacedByToken
            FROM dbo.RefreshTokens
            WHERE token = @Token;
            """;

        using var connection = connectionFactory.CreateConnection();
        return await connection.QuerySingleOrDefaultAsync<RefreshTokenEntity>(new CommandDefinition(sql, new { Token = token }, cancellationToken: cancellationToken));
    }

    public async Task RevokeRefreshTokenAsync(string token, DateTime revokedAtUtc, string? replacedByToken, CancellationToken cancellationToken = default)
    {
        const string sql = """
            UPDATE dbo.RefreshTokens
            SET revoked_at = @RevokedAt, replaced_by_token = @ReplacedByToken
            WHERE token = @Token;
            """;

        using var connection = connectionFactory.CreateConnection();
        await connection.ExecuteAsync(new CommandDefinition(sql, new { Token = token, RevokedAt = revokedAtUtc, ReplacedByToken = replacedByToken }, cancellationToken: cancellationToken));
    }

    public async Task RevokeRefreshTokensForDeviceAsync(string deviceName, CancellationToken cancellationToken = default)
    {
        const string sql = """
            UPDATE dbo.RefreshTokens
            SET revoked_at = COALESCE(revoked_at, SYSUTCDATETIME())
            WHERE device_name = @DeviceName AND revoked_at IS NULL;
            """;

        using var connection = connectionFactory.CreateConnection();
        await connection.ExecuteAsync(new CommandDefinition(sql, new { DeviceName = deviceName }, cancellationToken: cancellationToken));
    }

    public async Task RevokeAccessTokenAsync(RevokedTokenEntity revokedToken, CancellationToken cancellationToken = default)
    {
        const string sql = """
            MERGE dbo.RevokedTokens AS target
            USING (SELECT @Jti AS jti) AS source
            ON target.jti = source.jti
            WHEN NOT MATCHED THEN
                INSERT (jti, user_id, device_name, reason, expires_at, revoked_at)
                VALUES (@Jti, @UserId, @DeviceName, @Reason, @ExpiresAt, @RevokedAt);
            """;

        using var connection = connectionFactory.CreateConnection();
        await connection.ExecuteAsync(new CommandDefinition(sql, revokedToken, cancellationToken: cancellationToken));
    }

    public async Task<bool> IsTokenRevokedAsync(string jti, CancellationToken cancellationToken = default)
    {
        const string sql = "SELECT COUNT(1) FROM dbo.RevokedTokens WHERE jti = @Jti;";
        using var connection = connectionFactory.CreateConnection();
        return await connection.ExecuteScalarAsync<int>(new CommandDefinition(sql, new { Jti = jti }, cancellationToken: cancellationToken)) > 0;
    }

    public async Task<bool> IsDeviceAuthorizedAsync(string deviceName, int userId, CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT COUNT(1)
            FROM dbo.RegisteredDevices
            WHERE device_name = @DeviceName AND user_id = @UserId AND is_active = 1;
            """;

        using var connection = connectionFactory.CreateConnection();
        return await connection.ExecuteScalarAsync<int>(new CommandDefinition(sql, new { DeviceName = deviceName, UserId = userId }, cancellationToken: cancellationToken)) > 0;
    }
}

public sealed class DeviceRepository(ISqlConnectionFactory connectionFactory) : IDeviceRepository
{
    public async Task<(IReadOnlyCollection<RegisteredDeviceEntity> Items, int TotalCount)> GetDevicesAsync(DeviceQueryParameters query, CancellationToken cancellationToken = default)
    {
        var parameters = new DynamicParameters();
        var conditions = new List<string>();
        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            conditions.Add("(rd.device_name LIKE @Search OR u.name LIKE @Search OR u.email LIKE @Search)");
            parameters.Add("Search", $"%{query.Search.Trim()}%");
        }

        if (query.IsActive is not null)
        {
            conditions.Add("rd.is_active = @IsActive");
            parameters.Add("IsActive", query.IsActive);
        }

        var whereClause = conditions.Count == 0 ? string.Empty : $"WHERE {string.Join(" AND ", conditions)}";
        parameters.Add("Offset", RepositoryPaging.GetOffset(query.Page, query.PageSize));
        parameters.Add("PageSize", RepositoryPaging.NormalizePageSize(query.PageSize));

        var sql = $"""
            SELECT
                rd.id AS Id,
                rd.device_name AS DeviceName,
                rd.user_id AS UserId,
                u.name AS UserName,
                u.email AS UserEmail,
                rd.is_active AS IsActive,
                rd.last_login AS LastLogin,
                rd.registered_at AS RegisteredAt,
                rd.registered_by AS RegisteredBy,
                adminUser.name AS RegisteredByName,
                rd.notes AS Notes
            FROM dbo.RegisteredDevices rd
            INNER JOIN dbo.Users u ON u.id = rd.user_id
            INNER JOIN dbo.Users adminUser ON adminUser.id = rd.registered_by
            {whereClause}
            ORDER BY rd.registered_at DESC
            OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;

            SELECT COUNT(1)
            FROM dbo.RegisteredDevices rd
            INNER JOIN dbo.Users u ON u.id = rd.user_id
            {whereClause};
            """;

        using var connection = connectionFactory.CreateConnection();
        using var multi = await connection.QueryMultipleAsync(new CommandDefinition(sql, parameters, cancellationToken: cancellationToken));
        var items = (await multi.ReadAsync<RegisteredDeviceEntity>()).AsList();
        var totalCount = await multi.ReadSingleAsync<int>();
        return (items, totalCount);
    }

    public async Task<RegisteredDeviceEntity?> GetByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT
                rd.id AS Id,
                rd.device_name AS DeviceName,
                rd.user_id AS UserId,
                u.name AS UserName,
                u.email AS UserEmail,
                rd.is_active AS IsActive,
                rd.last_login AS LastLogin,
                rd.registered_at AS RegisteredAt,
                rd.registered_by AS RegisteredBy,
                adminUser.name AS RegisteredByName,
                rd.notes AS Notes
            FROM dbo.RegisteredDevices rd
            INNER JOIN dbo.Users u ON u.id = rd.user_id
            INNER JOIN dbo.Users adminUser ON adminUser.id = rd.registered_by
            WHERE rd.id = @Id;
            """;

        using var connection = connectionFactory.CreateConnection();
        return await connection.QuerySingleOrDefaultAsync<RegisteredDeviceEntity>(new CommandDefinition(sql, new { Id = id }, cancellationToken: cancellationToken));
    }

    public async Task<int> CreateAsync(RegisteredDeviceEntity device, CancellationToken cancellationToken = default)
    {
        const string sql = """
            INSERT INTO dbo.RegisteredDevices (
                device_name, user_id, is_active, last_login, registered_at, registered_by, notes
            )
            VALUES (
                @DeviceName, @UserId, @IsActive, @LastLogin, @RegisteredAt, @RegisteredBy, @Notes
            );

            SELECT CAST(SCOPE_IDENTITY() AS INT);
            """;

        using var connection = connectionFactory.CreateConnection();
        return await connection.ExecuteScalarAsync<int>(new CommandDefinition(sql, device, cancellationToken: cancellationToken));
    }

    public async Task<bool> ToggleAsync(int id, bool isActive, CancellationToken cancellationToken = default)
    {
        const string sql = "UPDATE dbo.RegisteredDevices SET is_active = @IsActive WHERE id = @Id;";
        using var connection = connectionFactory.CreateConnection();
        return await connection.ExecuteAsync(new CommandDefinition(sql, new { Id = id, IsActive = isActive }, cancellationToken: cancellationToken)) > 0;
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken cancellationToken = default)
    {
        const string sql = "DELETE FROM dbo.RegisteredDevices WHERE id = @Id;";
        using var connection = connectionFactory.CreateConnection();
        return await connection.ExecuteAsync(new CommandDefinition(sql, new { Id = id }, cancellationToken: cancellationToken)) > 0;
    }
}

public sealed class AuditLogRepository(ISqlConnectionFactory connectionFactory) : IAuditLogRepository
{
    public async Task<int> CreateAsync(AuditLogEntity auditLog, CancellationToken cancellationToken = default)
    {
        const string sql = """
            INSERT INTO dbo.AuditLogs (user_id, action, entity_type, entity_id, details_json, ip, created_at)
            VALUES (@UserId, @Action, @EntityType, @EntityId, @DetailsJson, @Ip, @CreatedAt);

            SELECT CAST(SCOPE_IDENTITY() AS INT);
            """;

        using var connection = connectionFactory.CreateConnection();
        return await connection.ExecuteScalarAsync<int>(new CommandDefinition(sql, auditLog, cancellationToken: cancellationToken));
    }
}

internal static class RepositoryPaging
{
    public static int GetOffset(int page, int pageSize) => (Math.Max(page, 1) - 1) * NormalizePageSize(pageSize);
    public static int NormalizePageSize(int pageSize) => Math.Clamp(pageSize, 1, 100);
}
