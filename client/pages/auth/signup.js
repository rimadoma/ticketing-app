import { useState } from 'react';
import useRequest from '../../hooks/use-request';
import ErrorAlert from '../../components/error-alert';
import Router from 'next/router';
import Link from 'next/link';

const SignUpPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { doRequest, errors } = useRequest({
        url: '/api/users/signup',
        method: 'post',
        body: { email, password },
        onSuccess: () => Router.push('/')
    });

    const onSubmit = async (e) => {
        e.preventDefault();

        await doRequest();
    }

    return (
        <form onSubmit={onSubmit}>
            <h1>Sign Up</h1>
            <div className="form-group">
                <label>Email Address</label>
                <input id="email" value={email} onChange={e => setEmail(e.target.value)} className="form-control" type="email" />
            </div>
            <div className="form-group">
                <label>Password</label>
                <input id="password" value={password} onChange={e => setPassword(e.target.value)} className="form-control" type="password" />
            </div>
            <button className="btn btn-primary">Sign Up</button>
            <ErrorAlert errors={errors} />
            <p className="mt-2">Already have an account? <Link href="/auth/signin">Sign in here!</Link></p>
        </form>
    );
};

export default SignUpPage;