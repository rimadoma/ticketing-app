import { useState } from 'react';
import useRequest from '../../hooks/use-request';

const SignUpPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { doRequest, errors } = useRequest({
        url: '/api/users/signup',
        method: 'post',
        body: { email, password }
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
            {errors}
        </form>
    );
};

export default SignUpPage;