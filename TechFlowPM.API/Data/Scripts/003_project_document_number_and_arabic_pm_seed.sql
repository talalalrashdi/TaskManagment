IF COL_LENGTH(N'dbo.Projects', N'document_number') IS NULL
BEGIN
    ALTER TABLE dbo.Projects
    ADD document_number NVARCHAR(100) NULL;
END;
GO

UPDATE dbo.Users
SET name = N'مدير النظام'
WHERE email = N'admin@techflow.local';
GO

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
    VALUES (N'ناصر الشهري', N'nasser@techflow.local', N'VlnHjLMkAkQUYF10/HbUkw==.8Nxx0FVHiU4dPsnPqA6W9EHgVPji3+ZWikVKwt037ss=', N'Project Manager', NULL, 2);
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE email = N'faisal@techflow.local')
BEGIN
    INSERT INTO dbo.Users (name, email, password_hash, role, avatar, department_id)
    VALUES (N'فيصل العتيبي', N'faisal@techflow.local', N'VlnHjLMkAkQUYF10/HbUkw==.8Nxx0FVHiU4dPsnPqA6W9EHgVPji3+ZWikVKwt037ss=', N'Project Manager', NULL, 3);
END;
GO

UPDATE dbo.Projects
SET document_number = CASE title
    WHEN N'TechFlow Core Platform' THEN N'DOC-2026-001'
    WHEN N'Datacenter Firewall Refresh' THEN N'DOC-2026-002'
    WHEN N'المشروع التجريبي' THEN N'DOC-2026-003'
    ELSE document_number
END
WHERE document_number IS NULL;
GO
