import { useState } from 'react';
import axios from 'axios';

const useRequest = ({ url, method, body, onSuccess }) => {
    const [errors, setErrors] = useState(null);

    const doRequest = async () => {
        const methodRef = axios[method];
        if (!methodRef) {
            setErrors([{ message: `Unknown method: ${method}!` }]);
            return;
        }

        try {
            setErrors(null);
            const response = await methodRef(url, body);

            if (onSuccess) {
                onSuccess(response.data);
            }

            return response.data;
        } catch (err) {
            setErrors(err.response?.data?.errors ?? [{ message: 'Something went wrong' }]);
        }
    };

    return { doRequest, errors };
};

export default useRequest;