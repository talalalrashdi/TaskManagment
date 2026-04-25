IF OBJECT_ID(N'dbo.TaskAssignees', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.TaskAssignees (
        task_id INT NOT NULL,
        user_id INT NOT NULL,
        assigned_at DATETIME2 NOT NULL CONSTRAINT DF_TaskAssignees_AssignedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_TaskAssignees PRIMARY KEY (task_id, user_id),
        CONSTRAINT FK_TaskAssignees_Task FOREIGN KEY (task_id) REFERENCES dbo.Tasks(id) ON DELETE CASCADE,
        CONSTRAINT FK_TaskAssignees_User FOREIGN KEY (user_id) REFERENCES dbo.Users(id)
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TaskAssignees_User' AND object_id = OBJECT_ID(N'dbo.TaskAssignees'))
BEGIN
    CREATE INDEX IX_TaskAssignees_User ON dbo.TaskAssignees(user_id, task_id);
END;
GO

INSERT INTO dbo.TaskAssignees (task_id, user_id)
SELECT t.id, t.assigned_to_id
FROM dbo.Tasks t
WHERE t.assigned_to_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM dbo.TaskAssignees ta
      WHERE ta.task_id = t.id
        AND ta.user_id = t.assigned_to_id
  );
GO
