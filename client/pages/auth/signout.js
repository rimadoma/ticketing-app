import { useEffect } from 'react';
import useRequest from '../../hooks/use-request';
import ErrorAlert from '../../components/error-alert';
import Router from 'next/router';

const SignOutPage = () => {
    const { doRequest, errors } = useRequest({
        url: '/api/users/signout',
        method: 'post',
        onSuccess: () => Router.push('/')
    });

    useEffect(() => {
        doRequest();
    }, []);

    return (
        <div>
            <div>Signing you out</div>
            <ErrorAlert errors={errors} />
        </div>
    );
};

export default SignOutPage;