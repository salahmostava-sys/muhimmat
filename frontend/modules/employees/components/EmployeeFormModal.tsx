import AddEmployeeModal from '@shared/components/employees/AddEmployeeModal';
import type { Employee } from '@modules/employees/model/employeeUtils';

export function EmployeeFormModal(props: Readonly<{
  open: boolean;
  editEmployee: Employee | null;
  onClose: () => void;
  onSuccess: () => void;
}>) {
  const { open, editEmployee, onClose, onSuccess } = props;
  if (!open) return null;
  return (
    <AddEmployeeModal
      onClose={onClose}
      editEmployee={editEmployee}
      onSuccess={onSuccess}
    />
  );
}
