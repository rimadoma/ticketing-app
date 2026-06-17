const ErrorAlert = ({ errors }) => {
    if (!errors) {
        return null;
    }

    return (
        <div className="alert alert-danger">
            <h4>Oops...</h4>
            <ul className='my-0'>
                {errors.map(err => (
                    <li key={err.message}>{err.field ? `${err.field}: ` : ''}{err.message}</li>
                ))}
            </ul>
        </div>
    );
};

export default ErrorAlert;
