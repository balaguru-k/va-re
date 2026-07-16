import { useState, useCallback, useEffect } from 'react';
import { checklistAPI } from '../services/api';

const useFilterOptions = () => {
    const [categories, setCategories] = useState([]);
    const [locations, setLocations] = useState([]);
    const [departments, setDepartments] = useState([]);

    const fetchOptions = useCallback(async (filters = {}) => {
        try {
            const { category, location } = filters;

            // Categories always fetch all
            const catRes = await checklistAPI.getCategories();
            setCategories((catRes.data.categories || []).map(c => c.name).filter(Boolean).sort());

            // Locations: cascade by category
            if (category && category.length > 0) {
                const locRes = await checklistAPI.getLocations({ category_name: category.join('|||') });
                setLocations((locRes.data.locations || []).map(l => l.name).filter(Boolean).sort());
            } else {
                const locRes = await checklistAPI.getLocations();
                setLocations((locRes.data.locations || []).map(l => l.name).filter(Boolean).sort());
            }

            // Departments: cascade by location + category
            if (location && location.length > 0) {
                const params = { location_name: location.join('|||') };
                if (category && category.length > 0) params.category_name = category.join('|||');
                const deptRes = await checklistAPI.getDepartments(params);
                setDepartments((deptRes.data.departments || []).map(d => d.name).filter(Boolean).sort());
            } else {
                const deptRes = await checklistAPI.getDepartments();
                setDepartments((deptRes.data.departments || []).map(d => d.name).filter(Boolean).sort());
            }
        } catch (err) {
            console.error('Error fetching filter options:', err);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchOptions();
    }, [fetchOptions]);

    return { categories, locations, departments, fetchOptions };
};

export default useFilterOptions;
