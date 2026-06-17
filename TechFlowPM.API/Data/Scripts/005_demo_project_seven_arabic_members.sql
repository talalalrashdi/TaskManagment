UPDATE dbo.Users
SET name = N'طلال الراشدي'
WHERE email = N'fatma@techflow.local';
GO

UPDATE dbo.Users
SET name = N'سعيد السلامي'
WHERE email = N'saeed@techflow.local';
GO

UPDATE dbo.Users
SET name = N'محمد النعماني'
WHERE email = N'aisha@techflow.local';
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE email = N'mohammed@techflow.local')
BEGIN
    INSERT INTO dbo.Users (name, email, password_hash, role, avatar, department_id)
    VALUES (N'خالد البوسعيدي', N'mohammed@techflow.local', N'VlnHjLMkAkQUYF10/HbUkw==.8Nxx0FVHiU4dPsnPqA6W9EHgVPji3+ZWikVKwt037ss=', N'Project Manager', NULL, 1);
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE email = N'nasser@techflow.local')
BEGIN
    INSERT INTO dbo.Users (name, email, password_hash, role, avatar, department_id)
    VALUES (N'ناصر الشهري', N'nasser@techflow.local', N'VlnHjLMkAkQUYF10/HbUkw==.8Nxx0FVHiU4dPsnPqA6W9EHgVPji3+ZWikVKwt037ss=', N'Member', NULL, 2);
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE email = N'faisal@techflow.local')
BEGIN
    INSERT INTO dbo.Users (name, email, password_hash, role, avatar, department_id)
    VALUES (N'فيصل العتيبي', N'faisal@techflow.local', N'VlnHjLMkAkQUYF10/HbUkw==.8Nxx0FVHiU4dPsnPqA6W9EHgVPji3+ZWikVKwt037ss=', N'Member', NULL, 3);
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE email = N'majed@techflow.local')
BEGIN
    INSERT INTO dbo.Users (name, email, password_hash, role, avatar, department_id)
    VALUES (N'ماجد السهلي', N'majed@techflow.local', N'VlnHjLMkAkQUYF10/HbUkw==.8Nxx0FVHiU4dPsnPqA6W9EHgVPji3+ZWikVKwt037ss=', N'Member', NULL, 1);
END;
GO

IF EXISTS (SELECT 1 FROM dbo.Projects WHERE title = N'المشروع التجريبي')
BEGIN
    DECLARE @DemoProjectId INT = (SELECT TOP 1 id FROM dbo.Projects WHERE title = N'المشروع التجريبي');
    DECLARE @DemoManagerId INT = (SELECT TOP 1 id FROM dbo.Users WHERE email = N'fatma@techflow.local');
    DECLARE @DemoEngineerId INT = (SELECT TOP 1 id FROM dbo.Users WHERE email = N'saeed@techflow.local');
    DECLARE @DemoAnalystId INT = (SELECT TOP 1 id FROM dbo.Users WHERE email = N'aisha@techflow.local');
    DECLARE @DemoArchitectId INT = (SELECT TOP 1 id FROM dbo.Users WHERE email = N'mohammed@techflow.local');
    DECLARE @DemoNetworkId INT = (SELECT TOP 1 id FROM dbo.Users WHERE email = N'nasser@techflow.local');
    DECLARE @DemoQaId INT = (SELECT TOP 1 id FROM dbo.Users WHERE email = N'faisal@techflow.local');
    DECLARE @DemoFrontendId INT = (SELECT TOP 1 id FROM dbo.Users WHERE email = N'majed@techflow.local');

    UPDATE dbo.ProjectMembers
    SET role_in_project = N'مدير المشروع'
    WHERE project_id = @DemoProjectId AND user_id = @DemoManagerId;

    UPDATE dbo.ProjectMembers
    SET role_in_project = N'مهندس نظم'
    WHERE project_id = @DemoProjectId AND user_id = @DemoEngineerId;

    UPDATE dbo.ProjectMembers
    SET role_in_project = N'محلل أعمال'
    WHERE project_id = @DemoProjectId AND user_id = @DemoAnalystId;

    UPDATE dbo.ProjectMembers
    SET role_in_project = N'معماري حلول'
    WHERE project_id = @DemoProjectId AND user_id = @DemoArchitectId;

    UPDATE dbo.ProjectMembers
    SET role_in_project = N'مهندس شبكات'
    WHERE project_id = @DemoProjectId AND user_id = @DemoNetworkId;

    UPDATE dbo.ProjectMembers
    SET role_in_project = N'مهندس جودة'
    WHERE project_id = @DemoProjectId AND user_id = @DemoQaId;

    UPDATE dbo.ProjectMembers
    SET role_in_project = N'مهندس واجهات'
    WHERE project_id = @DemoProjectId AND user_id = @DemoFrontendId;

    IF NOT EXISTS (SELECT 1 FROM dbo.ProjectMembers WHERE project_id = @DemoProjectId AND user_id = @DemoManagerId)
    BEGIN
        INSERT INTO dbo.ProjectMembers (project_id, user_id, role_in_project)
        VALUES (@DemoProjectId, @DemoManagerId, N'مدير المشروع');
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.ProjectMembers WHERE project_id = @DemoProjectId AND user_id = @DemoEngineerId)
    BEGIN
        INSERT INTO dbo.ProjectMembers (project_id, user_id, role_in_project)
        VALUES (@DemoProjectId, @DemoEngineerId, N'مهندس نظم');
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.ProjectMembers WHERE project_id = @DemoProjectId AND user_id = @DemoAnalystId)
    BEGIN
        INSERT INTO dbo.ProjectMembers (project_id, user_id, role_in_project)
        VALUES (@DemoProjectId, @DemoAnalystId, N'محلل أعمال');
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.ProjectMembers WHERE project_id = @DemoProjectId AND user_id = @DemoArchitectId)
    BEGIN
        INSERT INTO dbo.ProjectMembers (project_id, user_id, role_in_project)
        VALUES (@DemoProjectId, @DemoArchitectId, N'معماري حلول');
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.ProjectMembers WHERE project_id = @DemoProjectId AND user_id = @DemoNetworkId)
    BEGIN
        INSERT INTO dbo.ProjectMembers (project_id, user_id, role_in_project)
        VALUES (@DemoProjectId, @DemoNetworkId, N'مهندس شبكات');
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.ProjectMembers WHERE project_id = @DemoProjectId AND user_id = @DemoQaId)
    BEGIN
        INSERT INTO dbo.ProjectMembers (project_id, user_id, role_in_project)
        VALUES (@DemoProjectId, @DemoQaId, N'مهندس جودة');
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.ProjectMembers WHERE project_id = @DemoProjectId AND user_id = @DemoFrontendId)
    BEGIN
        INSERT INTO dbo.ProjectMembers (project_id, user_id, role_in_project)
        VALUES (@DemoProjectId, @DemoFrontendId, N'مهندس واجهات');
    END;
END;
GO
