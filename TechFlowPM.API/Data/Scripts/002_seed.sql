IF NOT EXISTS (SELECT 1 FROM dbo.Departments)
BEGIN
    INSERT INTO dbo.Departments (name, type, color, icon)
    VALUES
        (N'Software Engineering', N'Software', N'#818CF8', N'code-2'),
        (N'Network Operations', N'Networks', N'#38BDF8', N'network'),
        (N'Cybersecurity', N'Security', N'#34D399', N'shield-check'),
        (N'Maintenance', N'Maintenance', N'#FB923C', N'wrench');
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE email = N'admin@techflow.local')
BEGIN
    INSERT INTO dbo.Users (name, email, password_hash, role, avatar, department_id)
    VALUES
        (N'System Admin', N'admin@techflow.local', N'VlnHjLMkAkQUYF10/HbUkw==.8Nxx0FVHiU4dPsnPqA6W9EHgVPji3+ZWikVKwt037ss=', N'Admin', NULL, 1),
        (N'Fatma Al-Harthi', N'fatma@techflow.local', N'VlnHjLMkAkQUYF10/HbUkw==.8Nxx0FVHiU4dPsnPqA6W9EHgVPji3+ZWikVKwt037ss=', N'Project Manager', NULL, 1),
        (N'Saeed Al-Balushi', N'saeed@techflow.local', N'VlnHjLMkAkQUYF10/HbUkw==.8Nxx0FVHiU4dPsnPqA6W9EHgVPji3+ZWikVKwt037ss=', N'Member', NULL, 3),
        (N'Aisha Al-Rawahi', N'aisha@techflow.local', N'VlnHjLMkAkQUYF10/HbUkw==.8Nxx0FVHiU4dPsnPqA6W9EHgVPji3+ZWikVKwt037ss=', N'Viewer', NULL, 2);
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.RegisteredDevices)
BEGIN
    INSERT INTO dbo.RegisteredDevices (device_name, user_id, is_active, last_login, registered_at, registered_by, notes)
    VALUES
        (N'ADMIN-WS-01', 1, 1, SYSUTCDATETIME(), SYSUTCDATETIME(), 1, N'Primary admin workstation'),
        (N'PM-ENG-01', 2, 1, DATEADD(DAY, -1, SYSUTCDATETIME()), SYSUTCDATETIME(), 1, N'Project manager laptop'),
        (N'SEC-OPS-02', 3, 1, DATEADD(DAY, -2, SYSUTCDATETIME()), SYSUTCDATETIME(), 1, N'Security engineer desktop');
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Projects)
BEGIN
    INSERT INTO dbo.Projects (
        title, description, type, status, priority, project_manager_id,
        responsible_department_id, beneficiary_department_id, budget, actual_cost,
        start_date, end_date
    )
    VALUES
        (
            N'TechFlow Core Platform',
            N'Internal platform unifying project operations, reporting, and executive updates across departments.',
            N'Software', N'Active', N'Critical', 2,
            1, 1, 75000, 28500,
            DATEADD(DAY, -20, SYSUTCDATETIME()), DATEADD(DAY, 70, SYSUTCDATETIME())
        ),
        (
            N'Datacenter Firewall Refresh',
            N'Replacement of edge firewall appliances with hardening review and migration support.',
            N'Cybersecurity', N'Planning', N'High', 2,
            3, 2, 42000, 7500,
            DATEADD(DAY, 5, SYSUTCDATETIME()), DATEADD(DAY, 95, SYSUTCDATETIME())
        );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.ProjectMembers)
BEGIN
    INSERT INTO dbo.ProjectMembers (project_id, user_id, role_in_project)
    VALUES
        (1, 2, N'Project Manager'),
        (1, 3, N'Security Specialist'),
        (2, 2, N'Project Manager'),
        (2, 3, N'Implementation Engineer');
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Tasks)
BEGIN
    INSERT INTO dbo.Tasks (
        project_id, title, description, assigned_to_id, created_by_id,
        status, priority, due_date, estimated_hours, actual_hours, order_index
    )
    VALUES
        (1, N'Foundation architecture', N'Define API modules, repositories, and frontend routing.', 2, 1, N'Done', N'High', DATEADD(DAY, -5, SYSUTCDATETIME()), 24, 22, 1),
        (1, N'Device login workflow', N'Implement auto-login via registered devices and audit logging.', 3, 2, N'InProgress', N'Critical', DATEADD(DAY, 3, SYSUTCDATETIME()), 18, 9, 2),
        (1, N'Kanban board UI', N'Interactive tasks board with drag and drop status updates.', 2, 2, N'Todo', N'Medium', DATEADD(DAY, 8, SYSUTCDATETIME()), 16, 0, 3),
        (2, N'Firewall asset inventory', N'Collect serial numbers and export current running config.', 3, 2, N'Review', N'High', DATEADD(DAY, 12, SYSUTCDATETIME()), 12, 10, 1);
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.ExecutiveUpdates)
BEGIN
    INSERT INTO dbo.ExecutiveUpdates (project_id, content, update_type, created_by_id)
    VALUES
        (1, N'Completed service boundaries and API naming conventions for the first release.', N'Milestone', 2),
        (1, N'Device-based authentication is under active implementation with audit coverage.', N'StatusUpdate', 2),
        (2, N'Waiting for vendor maintenance window confirmation before scheduling cutover.', N'Issue', 3);
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Licenses)
BEGIN
    INSERT INTO dbo.Licenses (
        name, type, key_value, vendor, purchase_date, expiry_date, cost,
        renewal_reminder_days, project_id, notes, status
    )
    VALUES
        (
            N'FortiGate Subscription',
            N'Software',
            N'z8df99PArvSvGE2zWEMJgawFDQ8Ey6PK7QYepjGsUo4=',
            N'Fortinet',
            DATEADD(MONTH, -10, SYSUTCDATETIME()),
            DATEADD(DAY, 14, SYSUTCDATETIME()),
            3200,
            30,
            2,
            N'Annual subscription for edge firewall services.',
            N'Expiring'
        ),
        (
            N'Wildcard SSL Certificate',
            N'Certificate',
            N'8yOl8mry4hf0HDl+CkR3FPi61Ux+kDirOgpFa7arcVY=',
            N'DigiCert',
            DATEADD(MONTH, -11, SYSUTCDATETIME()),
            DATEADD(DAY, -2, SYSUTCDATETIME()),
            560,
            20,
            NULL,
            N'Public certificate for internal portals.',
            N'Expired'
        );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Notifications)
BEGIN
    INSERT INTO dbo.Notifications (user_id, title, message, type, is_read, related_entity_type, related_entity_id)
    VALUES
        (2, N'Project update posted', N'A new executive update was added to TechFlow Core Platform.', N'project:updateAdded', 0, N'Project', 1),
        (3, N'License nearing expiry', N'FortiGate Subscription expires within 14 days.', N'license:expiringSoon', 0, N'License', 1);
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Projects WHERE title = N'المشروع التجريبي')
BEGIN
    DECLARE @DemoManagerId INT = (SELECT TOP 1 id FROM dbo.Users WHERE email = N'fatma@techflow.local');
    DECLARE @DemoResponsibleDeptId INT = (SELECT TOP 1 id FROM dbo.Departments WHERE type = N'Software');
    DECLARE @DemoBeneficiaryDeptId INT = (SELECT TOP 1 id FROM dbo.Departments WHERE type = N'Networks');

    INSERT INTO dbo.Projects (
        title, description, type, status, priority, project_manager_id,
        responsible_department_id, beneficiary_department_id, budget, actual_cost,
        start_date, end_date
    )
    VALUES (
        N'المشروع التجريبي',
        N'مشروع تجريبي لعرض شكل البطاقات ولوحة التحكم وقائمة المشاريع داخل نظام TechFlow PM.',
        N'Software', N'Active', N'High', @DemoManagerId,
        @DemoResponsibleDeptId, @DemoBeneficiaryDeptId, 18000, 7200,
        DATEADD(DAY, -12, SYSUTCDATETIME()), DATEADD(DAY, 45, SYSUTCDATETIME())
    );
END;
GO

DECLARE @DemoProjectId INT = (SELECT TOP 1 id FROM dbo.Projects WHERE title = N'المشروع التجريبي');
DECLARE @DemoAdminId INT = (SELECT TOP 1 id FROM dbo.Users WHERE email = N'admin@techflow.local');
DECLARE @DemoManagerId_Seed INT = (SELECT TOP 1 id FROM dbo.Users WHERE email = N'fatma@techflow.local');
DECLARE @DemoMemberId_Seed INT = (SELECT TOP 1 id FROM dbo.Users WHERE email = N'saeed@techflow.local');
DECLARE @DemoViewerId_Seed INT = (SELECT TOP 1 id FROM dbo.Users WHERE email = N'aisha@techflow.local');

IF @DemoProjectId IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.ProjectMembers WHERE project_id = @DemoProjectId AND user_id = @DemoManagerId_Seed)
    BEGIN
        INSERT INTO dbo.ProjectMembers (project_id, user_id, role_in_project)
        VALUES (@DemoProjectId, @DemoManagerId_Seed, N'Project Manager');
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.ProjectMembers WHERE project_id = @DemoProjectId AND user_id = @DemoMemberId_Seed)
    BEGIN
        INSERT INTO dbo.ProjectMembers (project_id, user_id, role_in_project)
        VALUES (@DemoProjectId, @DemoMemberId_Seed, N'Backend Engineer');
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.ProjectMembers WHERE project_id = @DemoProjectId AND user_id = @DemoViewerId_Seed)
    BEGIN
        INSERT INTO dbo.ProjectMembers (project_id, user_id, role_in_project)
        VALUES (@DemoProjectId, @DemoViewerId_Seed, N'Business Reviewer');
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.Tasks WHERE project_id = @DemoProjectId AND title = N'تصميم واجهة لوحة التحكم')
    BEGIN
        INSERT INTO dbo.Tasks (
            project_id, title, description, assigned_to_id, created_by_id,
            status, priority, due_date, estimated_hours, actual_hours, order_index
        )
        VALUES
            (@DemoProjectId, N'تصميم واجهة لوحة التحكم', N'إعداد العرض المرئي الرئيسي للوحة التحكم للمستخدم.', @DemoManagerId_Seed, @DemoAdminId, N'Done', N'High', DATEADD(DAY, -4, SYSUTCDATETIME()), 10, 9, 1),
            (@DemoProjectId, N'إضافة بطاقات المشاريع', N'عرض المشاريع في Cards مع نسبة الإنجاز والأعضاء.', @DemoMemberId_Seed, @DemoManagerId_Seed, N'InProgress', N'High', DATEADD(DAY, 4, SYSUTCDATETIME()), 12, 5, 2),
            (@DemoProjectId, N'مراجعة التجربة النهائية', N'مراجعة التصميم واعتماد النسخة النهائية للعرض.', @DemoViewerId_Seed, @DemoManagerId_Seed, N'Todo', N'Medium', DATEADD(DAY, 9, SYSUTCDATETIME()), 6, 0, 3);
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.ExecutiveUpdates WHERE project_id = @DemoProjectId AND content = N'تم تجهيز المشروع التجريبي ليظهر داخل لوحة التحكم مع تقدم فعلي وأعضاء ومهام.')
    BEGIN
        INSERT INTO dbo.ExecutiveUpdates (project_id, content, update_type, created_by_id)
        VALUES (@DemoProjectId, N'تم تجهيز المشروع التجريبي ليظهر داخل لوحة التحكم مع تقدم فعلي وأعضاء ومهام.', N'Achievement', @DemoManagerId_Seed);
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.Notifications WHERE related_entity_type = N'Project' AND related_entity_id = @DemoProjectId AND title = N'تم إنشاء مشروع تجريبي')
    BEGIN
        INSERT INTO dbo.Notifications (user_id, title, message, type, is_read, related_entity_type, related_entity_id)
        VALUES
            (@DemoManagerId_Seed, N'تم إنشاء مشروع تجريبي', N'تمت إضافة المشروع التجريبي إلى لوحة التحكم بنجاح.', N'project:updateAdded', 0, N'Project', @DemoProjectId);
    END;
END;
GO
