import type { UserRole } from "@/types/domain";

export type RoleDefinition = {
  value: UserRole;
  label: string;
  shortLabel: string;
  description: string;
  scope: string;
  color: string;
  legacy?: boolean;
};

export const roleDefinitions: RoleDefinition[] = [
  {
    value: "Department Chair",
    label: "رئيس الدائرة",
    shortLabel: "رئيس الدائرة",
    description: "يشاهد جميع المشاريع الخاصة بجميع الأقسام مع كامل التفاصيل التنفيذية.",
    scope: "وصول شامل للقراءة على مستوى المؤسسة.",
    color: "#0d7573",
  },
  {
    value: "Chair Office",
    label: "مكتب الرئيس",
    shortLabel: "مكتب الرئيس",
    description: "يشاهد جميع المشاريع الخاصة بجميع الأقسام مع كامل التفاصيل التنفيذية.",
    scope: "وصول شامل للقراءة على مستوى المؤسسة.",
    color: "#0f8f83",
  },
  {
    value: "Department Director",
    label: "مدير الدائرة",
    shortLabel: "مدير الدائرة",
    description: "يشاهد جميع المشاريع والأعمال الخاصة بدائرته فقط.",
    scope: "وصول قرائي على مستوى الدائرة.",
    color: "#2e7cf6",
  },
  {
    value: "Section Head",
    label: "رئيس القسم",
    shortLabel: "رئيس القسم",
    description: "يشاهد جميع المشاريع والأعمال الخاصة بقسمه.",
    scope: "وصول قرائي على مستوى القسم.",
    color: "#5163d9",
  },
  {
    value: "Division Supervisor",
    label: "مشرف شعبة",
    shortLabel: "مشرف شعبة",
    description: "يشاهد جميع المشاريع والأعمال الخاصة بشعبته.",
    scope: "وصول قرائي على مستوى الشعبة.",
    color: "#7a56d8",
  },
  {
    value: "Division Member",
    label: "مستخدم داخل شعبة",
    shortLabel: "مستخدم شعبة",
    description: "يشاهد المشاريع المرتبطة بشعبته.",
    scope: "وصول قرائي محدود ضمن الشعبة.",
    color: "#6c7c82",
  },
  {
    value: "Admin",
    label: "مدير النظام",
    shortLabel: "مدير النظام",
    description: "يدخل إلى صفحة الإدارة ويتحكم بالنظام كاملًا من ناحية إضافة الدوائر ومنح الصلاحيات للمستخدمين.",
    scope: "إدارة كاملة للنظام والمستخدمين.",
    color: "#ef7c61",
  },
  {
    value: "Project Manager",
    label: "مدير مشروع",
    shortLabel: "مدير مشروع",
    description: "دور تشغيلي متوافق مع الإعدادات السابقة لإدارة المشاريع.",
    scope: "متوافق مع الأدوار السابقة.",
    color: "#0d7573",
    legacy: true,
  },
  {
    value: "Member",
    label: "مستخدم",
    shortLabel: "مستخدم",
    description: "دور تشغيلي سابق يركز على مشاركة المستخدم داخل المشاريع والمهام المسندة.",
    scope: "متوافق مع الأدوار السابقة.",
    color: "#5c6bd8",
    legacy: true,
  },
  {
    value: "Viewer",
    label: "مشاهد",
    shortLabel: "مشاهد",
    description: "دور قراءة عام متوافق مع الإعدادات السابقة.",
    scope: "متوافق مع الأدوار السابقة.",
    color: "#7c8f91",
    legacy: true,
  },
];

export const primaryRoleDefinitions = roleDefinitions.filter((role) => !role.legacy);
export const selectableRoleDefinitions = roleDefinitions;

const roleDefinitionMap = new Map(roleDefinitions.map((role) => [role.value, role]));

export function getRoleDefinition(role: UserRole) {
  return roleDefinitionMap.get(role) ?? roleDefinitions[0];
}

export function translateUserRole(role: UserRole) {
  return getRoleDefinition(role).label;
}

export function getRoleTone(role: UserRole) {
  return getRoleDefinition(role).color;
}

export const departmentTypeOptions = [
  { value: "Software", label: "برمجيات" },
  { value: "Networks", label: "شبكات" },
  { value: "Security", label: "أمن سيبراني" },
  { value: "Maintenance", label: "صيانة" },
] as const;

export const departmentIconOptions = [
  { value: "briefcase", label: "حقيبة" },
  { value: "building-2", label: "مبنى" },
  { value: "network", label: "شبكة" },
  { value: "shield-check", label: "درع" },
  { value: "wrench", label: "عدة" },
  { value: "folders", label: "ملفات" },
] as const;
