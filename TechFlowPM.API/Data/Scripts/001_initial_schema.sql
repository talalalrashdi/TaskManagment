IF OBJECT_ID(N'dbo.Departments', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Departments (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(150) NOT NULL,
        type NVARCHAR(50) NOT NULL,
        color NVARCHAR(20) NOT NULL,
        icon NVARCHAR(100) NOT NULL
    );
END;
GO

IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Users (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(150) NOT NULL,
        email NVARCHAR(255) NOT NULL UNIQUE,
        password_hash NVARCHAR(500) NOT NULL,
        role NVARCHAR(50) NOT NULL,
        avatar NVARCHAR(500) NULL,
        department_id INT NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_Users_Department FOREIGN KEY (department_id) REFERENCES dbo.Departments(id)
    );
END;
GO

IF OBJECT_ID(N'dbo.Projects', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Projects (
        id INT IDENTITY(1,1) PRIMARY KEY,
        title NVARCHAR(200) NOT NULL,
        description NVARCHAR(MAX) NOT NULL,
        type NVARCHAR(50) NOT NULL,
        status NVARCHAR(50) NOT NULL,
        priority NVARCHAR(50) NOT NULL,
        project_manager_id INT NOT NULL,
        responsible_department_id INT NOT NULL,
        beneficiary_department_id INT NOT NULL,
        budget DECIMAL(18,2) NOT NULL,
        actual_cost DECIMAL(18,2) NOT NULL,
        start_date DATETIME2 NOT NULL,
        end_date DATETIME2 NOT NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_Projects_CreatedAt DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL CONSTRAINT DF_Projects_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_Projects_ProjectManager FOREIGN KEY (project_manager_id) REFERENCES dbo.Users(id),
        CONSTRAINT FK_Projects_ResponsibleDepartment FOREIGN KEY (responsible_department_id) REFERENCES dbo.Departments(id),
        CONSTRAINT FK_Projects_BeneficiaryDepartment FOREIGN KEY (beneficiary_department_id) REFERENCES dbo.Departments(id)
    );
END;
GO

IF OBJECT_ID(N'dbo.ProjectMembers', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ProjectMembers (
        id INT IDENTITY(1,1) PRIMARY KEY,
        project_id INT NOT NULL,
        user_id INT NOT NULL,
        role_in_project NVARCHAR(100) NOT NULL,
        joined_at DATETIME2 NOT NULL CONSTRAINT DF_ProjectMembers_JoinedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_ProjectMembers_ProjectUser UNIQUE (project_id, user_id),
        CONSTRAINT FK_ProjectMembers_Project FOREIGN KEY (project_id) REFERENCES dbo.Projects(id) ON DELETE CASCADE,
        CONSTRAINT FK_ProjectMembers_User FOREIGN KEY (user_id) REFERENCES dbo.Users(id)
    );
END;
GO

IF OBJECT_ID(N'dbo.Tasks', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Tasks (
        id INT IDENTITY(1,1) PRIMARY KEY,
        project_id INT NOT NULL,
        title NVARCHAR(200) NOT NULL,
        description NVARCHAR(MAX) NOT NULL,
        assigned_to_id INT NULL,
        created_by_id INT NOT NULL,
        status NVARCHAR(50) NOT NULL,
        priority NVARCHAR(50) NOT NULL,
        due_date DATETIME2 NULL,
        estimated_hours DECIMAL(10,2) NOT NULL CONSTRAINT DF_Tasks_EstimatedHours DEFAULT 0,
        actual_hours DECIMAL(10,2) NOT NULL CONSTRAINT DF_Tasks_ActualHours DEFAULT 0,
        order_index INT NOT NULL CONSTRAINT DF_Tasks_OrderIndex DEFAULT 0,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_Tasks_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_Tasks_Project FOREIGN KEY (project_id) REFERENCES dbo.Projects(id) ON DELETE CASCADE,
        CONSTRAINT FK_Tasks_AssignedTo FOREIGN KEY (assigned_to_id) REFERENCES dbo.Users(id),
        CONSTRAINT FK_Tasks_CreatedBy FOREIGN KEY (created_by_id) REFERENCES dbo.Users(id)
    );
END;
GO

IF OBJECT_ID(N'dbo.ExecutiveUpdates', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ExecutiveUpdates (
        id INT IDENTITY(1,1) PRIMARY KEY,
        project_id INT NOT NULL,
        content NVARCHAR(MAX) NOT NULL,
        update_type NVARCHAR(50) NOT NULL,
        created_by_id INT NOT NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_ExecutiveUpdates_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_ExecutiveUpdates_Project FOREIGN KEY (project_id) REFERENCES dbo.Projects(id) ON DELETE CASCADE,
        CONSTRAINT FK_ExecutiveUpdates_CreatedBy FOREIGN KEY (created_by_id) REFERENCES dbo.Users(id)
    );
END;
GO

IF OBJECT_ID(N'dbo.Licenses', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Licenses (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(200) NOT NULL,
        type NVARCHAR(50) NOT NULL,
        key_value NVARCHAR(1000) NOT NULL,
        vendor NVARCHAR(200) NOT NULL,
        purchase_date DATETIME2 NOT NULL,
        expiry_date DATETIME2 NOT NULL,
        cost DECIMAL(18,2) NOT NULL,
        renewal_reminder_days INT NOT NULL,
        project_id INT NULL,
        notes NVARCHAR(MAX) NOT NULL,
        status NVARCHAR(50) NOT NULL,
        CONSTRAINT FK_Licenses_Project FOREIGN KEY (project_id) REFERENCES dbo.Projects(id) ON DELETE SET NULL
    );
END;
GO

IF OBJECT_ID(N'dbo.Notifications', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Notifications (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL,
        title NVARCHAR(200) NOT NULL,
        message NVARCHAR(1000) NOT NULL,
        type NVARCHAR(100) NOT NULL,
        is_read BIT NOT NULL CONSTRAINT DF_Notifications_IsRead DEFAULT 0,
        related_entity_type NVARCHAR(100) NULL,
        related_entity_id INT NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_Notifications_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_Notifications_User FOREIGN KEY (user_id) REFERENCES dbo.Users(id) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID(N'dbo.AuditLogs', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AuditLogs (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NULL,
        action NVARCHAR(200) NOT NULL,
        entity_type NVARCHAR(100) NOT NULL,
        entity_id NVARCHAR(100) NULL,
        details_json NVARCHAR(MAX) NOT NULL,
        ip NVARCHAR(100) NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_AuditLogs_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_AuditLogs_User FOREIGN KEY (user_id) REFERENCES dbo.Users(id)
    );
END;
GO

IF OBJECT_ID(N'dbo.RegisteredDevices', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.RegisteredDevices (
        id INT IDENTITY(1,1) PRIMARY KEY,
        device_name NVARCHAR(100) NOT NULL UNIQUE,
        user_id INT NOT NULL,
        is_active BIT NOT NULL CONSTRAINT DF_RegisteredDevices_IsActive DEFAULT 1,
        last_login DATETIME2 NULL,
        registered_at DATETIME2 NOT NULL CONSTRAINT DF_RegisteredDevices_RegisteredAt DEFAULT SYSUTCDATETIME(),
        registered_by INT NOT NULL,
        notes NVARCHAR(255) NULL,
        CONSTRAINT FK_RegisteredDevices_User FOREIGN KEY (user_id) REFERENCES dbo.Users(id),
        CONSTRAINT FK_RegisteredDevices_RegisteredBy FOREIGN KEY (registered_by) REFERENCES dbo.Users(id)
    );
END;
GO

IF OBJECT_ID(N'dbo.RefreshTokens', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.RefreshTokens (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL,
        token NVARCHAR(300) NOT NULL UNIQUE,
        device_name NVARCHAR(100) NOT NULL,
        expires_at DATETIME2 NOT NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_RefreshTokens_CreatedAt DEFAULT SYSUTCDATETIME(),
        revoked_at DATETIME2 NULL,
        replaced_by_token NVARCHAR(300) NULL,
        CONSTRAINT FK_RefreshTokens_User FOREIGN KEY (user_id) REFERENCES dbo.Users(id) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID(N'dbo.RevokedTokens', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.RevokedTokens (
        jti NVARCHAR(100) PRIMARY KEY,
        user_id INT NULL,
        device_name NVARCHAR(100) NULL,
        reason NVARCHAR(255) NULL,
        expires_at DATETIME2 NOT NULL,
        revoked_at DATETIME2 NOT NULL CONSTRAINT DF_RevokedTokens_RevokedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_RevokedTokens_User FOREIGN KEY (user_id) REFERENCES dbo.Users(id)
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Projects_Status_Type' AND object_id = OBJECT_ID(N'dbo.Projects'))
BEGIN
    CREATE INDEX IX_Projects_Status_Type ON dbo.Projects(status, type, project_manager_id);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Tasks_Project_Status' AND object_id = OBJECT_ID(N'dbo.Tasks'))
BEGIN
    CREATE INDEX IX_Tasks_Project_Status ON dbo.Tasks(project_id, status, assigned_to_id, due_date);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Licenses_Expiry' AND object_id = OBJECT_ID(N'dbo.Licenses'))
BEGIN
    CREATE INDEX IX_Licenses_Expiry ON dbo.Licenses(expiry_date, status);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Notifications_User_Read' AND object_id = OBJECT_ID(N'dbo.Notifications'))
BEGIN
    CREATE INDEX IX_Notifications_User_Read ON dbo.Notifications(user_id, is_read, created_at DESC);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_RegisteredDevices_Name_Active' AND object_id = OBJECT_ID(N'dbo.RegisteredDevices'))
BEGIN
    CREATE INDEX IX_RegisteredDevices_Name_Active ON dbo.RegisteredDevices(device_name, is_active);
END;
GO
