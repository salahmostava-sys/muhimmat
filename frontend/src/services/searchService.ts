import { supabase } from '@/integrations/supabase/client';
import { throwIfError } from '@/services/serviceError';

type EmployeeSearchRow = {
  id: string;
  name: string;
  name_en: string | null;
  phone: string | null;
  status: string;
};

type VehicleSearchRow = {
  id: string;
  plate_number: string;
  brand: string | null;
  model: string | null;
  status: string;
};

export const searchService = {
  searchEmployeesAndVehicles: async (query: string) => {
    const term = `%${query}%`;
    const [employeesRes, vehiclesRes] = await Promise.all([
      supabase
        .from('employees')
        .select('id, name, name_en, phone, status')
        .or(`name.ilike.${term},name_en.ilike.${term},phone.ilike.${term},national_id.ilike.${term}`)
        .eq('status', 'active')
        .limit(5),
      supabase
        .from('vehicles')
        .select('id, plate_number, brand, model, status')
        .ilike('plate_number', term)
        .limit(3),
    ]);
    throwIfError(employeesRes.error, 'searchService.searchEmployeesAndVehicles.employees');
    throwIfError(vehiclesRes.error, 'searchService.searchEmployeesAndVehicles.vehicles');
    return {
      employees: (employeesRes.data || []) as EmployeeSearchRow[],
      vehicles: (vehiclesRes.data || []) as VehicleSearchRow[],
      employeeError: null,
      vehicleError: null,
    };
  },
};
