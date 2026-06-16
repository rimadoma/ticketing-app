import { useState } from 'react';
import axios from 'axios';

function ErrorAlert({ errors }) {
    if (!errors.length) return null;

    return (
        <div className="alert alert-danger">
            <h4>Oops...</h4>
            <ul className='my-0'>
                {errors.map(err => <li key={err.message}>{err.message}</li>)}
            </ul>
        </div>
    );
}

const signUpPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errors, setErrors] = useState([])

    const onSubmit = async (e) => {
        e.preventDefault();

        try {
            await axios.post('/api/users/signup', { email, password });
            setErrors([]);
        } catch (err) {
            setErrors(err.response.data.errors);
        }
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
        </form>
    );
};

export default signUpPage;