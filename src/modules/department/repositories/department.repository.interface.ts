import { Department } from '@new-hros/libs-sql';

export interface DepartmentTreeNode extends Department {
  children: DepartmentTreeNode[];
}
