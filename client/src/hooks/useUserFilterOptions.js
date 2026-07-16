import { useState, useCallback } from 'react';
import api from '../services/api';

const useUserFilterOptions = () => {
    const [categories, setCategories] = useState([]);
    const [locations, setLocations] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchOptions = useCallback(async (filters = {}) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            const catValues = filters.category_name || filters.category || [];
            const locValues = filters.location_name || filters.location || [];
            if (catValues.length > 0) params.append('category_name', catValues.join('|||'));
            if (locValues.length > 0) params.append('location_name', locValues.join('|||'));
            const res = await api.get(`/reports/filter-options?${params.toString()}`);
            setCategories((res.data.categories || []).map(c => c.name).filter(Boolean).sort());
            setLocations((res.data.locations || []).map(l => l.name).filter(Boolean).sort());
            setDepartments((res.data.departments || []).map(d => d.name).filter(Boolean).sort());
        } catch (err) {
            console.error('Error fetching user filter options:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    return { categories, locations, departments, fetchOptions, loading };
};

export default useUserFilterOptions;
