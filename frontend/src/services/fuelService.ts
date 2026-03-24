// fuelService.ts

import { supabase } from '../supabaseClient';

export const fetchFuelData = async (startDate: string, endDate: string) => {
    // Querying fuel data
    const { data, error } = await supabase
        .from('fuel_data')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);

    if (error) {
        throw new Error(`Error fetching fuel data: ${error.message}`);
    }

    return data;
};

// Other service functions would go here.  
