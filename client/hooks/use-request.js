import { useState } from 'react';
import axios from 'axios';

function ErrorAlert({ errors }) {
    if (!errors) {
        return null;
    }

    return (
        <div className="alert alert-danger">
            <h4>Oops...</h4>
            <ul className='my-0'>
                {errors.map(err => <li key={err.message}>{err.field ? `${err.field}: ` : ''}{err.message}</li>)}
            </ul>
        </div>
    );
}

const useRequest = ({ url, method, body }) => {
    const [errors, setErrors] = useState(null);

    const doRequest = async () => {
        const methodRef = axios[method];
        if (!methodRef) {
            setErrors(<ErrorAlert errors={[{ message: `Unknown method: ${method}!` }]} />);
            return;
        }

        try {
            setErrors(null);
            const response = await methodRef(url, body);
            return response.data;
        } catch (err) {
            setErrors(<ErrorAlert errors={err.response?.data?.errors ?? [{ message: 'Something went wrong' }]} />);
        }
    };

    return { doRequest, errors };
};

export default useRequest;