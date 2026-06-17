IF COL_LENGTH(N'dbo.ExecutiveUpdates', N'title') IS NULL
BEGIN
    ALTER TABLE dbo.ExecutiveUpdates
    ADD title NVARCHAR(200) NULL;
END;
GO
