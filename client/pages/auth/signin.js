import { useState } from 'react';
import useRequest from '../../hooks/use-request';
import ErrorAlert from '../../components/error-alert';
import Router from 'next/router';

const SignInPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { doRequest, errors } = useRequest({
        url: '/api/users/signin',
        method: 'post',
        body: { email, password },
        onSuccess: () => Router.push('/')
    });

    const onSubmit = async (e) => {
        e.preventDefault();

        await doRequest();
    }


    // TODO add a sign up link
    return (
        <form onSubmit={onSubmit}>
            <h1>Sign In</h1>
            <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input id="email" value={email} onChange={e => setEmail(e.target.value)} className="form-control" type="email" />
            </div>
            <div className="form-group">
                <label htmlFor="password">Password</label>
                <input id="password" value={password} onChange={e => setPassword(e.target.value)} className="form-control" type="password" />
            </div>
            <button className="btn btn-primary">Sign In</button>
            <ErrorAlert errors={errors} />
        </form>
    );
};

export default SignInPage;