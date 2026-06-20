export type ApiResponse<T> = {
  success: boolean;
  data: T;
  message: string;
  errors: string[];
};

export type PagedResult<T> = {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type UserRole =
  | "Admin"
  | "Department Chair"
  | "Chair Office"
  | "Department Director"
  | "Section Head"
  | "Division Supervisor"
  | "Division Member"
  | "Project Manager"
  | "Member"
  | "Viewer";

export type Department = {
  id: number;
  name: string;
  type: "Software" | "Networks" | "Security" | "Maintenance";
  color: string;
  icon: string;
};

export type User = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string | null;
  departmentId?: number | null;
  departmentName?: string | null;
  departmentType?: string | null;
  createdAt: string;
};

export type Project = {
  id: number;
  title: string;
  documentNumber?: string | null;
  description: string;
  type: "Software" | "Networks" | "Cybersecurity" | "Maintenance";
  status: "Planning" | "Active" | "OnHold" | "Completed" | "Cancelled";
  priority: "Low" | "Medium" | "High" | "Critical";
  projectManagerId: number;
  projectManagerName?: string | null;
  responsibleDepartmentId: number;
  responsibleDepartmentName?: string | null;
  responsibleDepartmentColor?: string | null;
  beneficiaryDepartmentId: number;
  beneficiaryDepartmentName?: string | null;
  budget: number;
  actualCost: number;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
  totalTasks: number;
  completedTasks: number;
  blockedTasks: number;
  teamSize: number;
  progressPercent: number;
};

export type ProjectMember = {
  id: number;
  projectId: number;
  userId: number;
  roleInProject: string;
  joinedAt: string;
  userName: string;
  userEmail?: string | null;
  userAvatar?: string | null;
};

export type TaskAssignee = {
  userId: number;
  userName: string;
  userEmail?: string | null;
  userAvatar?: string | null;
};

export type Task = {
  id: number;
  projectId: number;
  title: string;
  description: string;
  assignedToId?: number | null;
  assignedToName?: string | null;
  assignees?: TaskAssignee[];
  createdById: number;
  createdByName?: string | null;
  status: "Todo" | "InProgress" | "Review" | "Done" | "Blocked";
  priority: "Low" | "Medium" | "High" | "Critical";
  dueDate?: string | null;
  estimatedHours: number;
  actualHours: number;
  orderIndex: number;
  createdAt: string;
};

export type ExecutiveUpdate = {
  id: number;
  projectId: number;
  title?: string | null;
  content: string;
  updateType: "StatusUpdate" | "Milestone" | "Issue" | "Achievement";
  createdById: number;
  createdByName?: string | null;
  createdAt: string;
};

export type ProjectDetail = {
  project: Project;
  members: ProjectMember[];
  recentUpdates: ExecutiveUpdate[];
};

export type ProjectSummary = {
  projectId: number;
  completionPercent: number;
  totalTasks: number;
  doneTasks: number;
  inProgressTasks: number;
  blockedTasks: number;
  budget: number;
  actualCost: number;
  variance: number;
  teamSize: number;
  latestUpdates: ExecutiveUpdate[];
};

export type ProjectTimelineItem = {
  id: number;
  title: string;
  type: Project["type"];
  status: Project["status"];
  startDate: string;
  endDate: string;
  responsibleDepartmentName?: string | null;
  responsibleDepartmentColor?: string | null;
  progressPercent: number;
};

export type License = {
  id: number;
  name: string;
  type: "OS" | "Software" | "Certificate" | "Domain" | "Other";
  keyValue: string;
  maskedKeyValue: string;
  vendor: string;
  purchaseDate: string;
  expiryDate: string;
  cost: number;
  renewalReminderDays: number;
  projectId?: number | null;
  projectTitle?: string | null;
  notes: string;
  status: "Active" | "Expired" | "Expiring";
  daysUntilExpiry: number;
};

export type Notification = {
  id: number;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  relatedEntityType?: string | null;
  relatedEntityId?: number | null;
  createdAt: string;
};

export type RegisteredDevice = {
  id: number;
  deviceName: string;
  userId: number;
  userName?: string | null;
  userEmail?: string | null;
  isActive: boolean;
  lastLogin?: string | null;
  registeredAt: string;
  registeredBy: number;
  registeredByName?: string | null;
  notes?: string | null;
};

export type ChartSlice = {
  label: string;
  value: number;
  color?: string | null;
};

export type DashboardStats = {
  activeProjects: number;
  overdueTasks: number;
  expiredLicenses: number;
  projectsByType: ChartSlice[];
  projectsByStatus: ChartSlice[];
  recentUpdates: ExecutiveUpdate[];
  expiringLicenses: License[];
};

export type AuthResponse = {
  token: string;
  refreshToken: string;
  user: User;
  expiresAtUtc: string;
  refreshExpiresAtUtc: string;
};
