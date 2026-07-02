import { useState } from 'react';
import useRequest from '../../hooks/use-request';
import ErrorAlert from '../../components/error-alert';
import Router from 'next/router';
import { CURRENCIES } from '../../constants';

const CreateTicket = () => {
    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState('EUR');
    const [validationErrors, setValidationErrors] = useState(null);
    const normalizedAmount = amount.replace(',', '.');
    const { doRequest, errors: requestErrors } = useRequest({
        url: '/api/tickets',
        method: 'post',
        body: { title, price: { amount: normalizedAmount, currency } },
        onSuccess: () => Router.push('/')
    });

    function isValidAmountFormat(amount) {
        return /^-?\d+([.,]\d{1,2})?$/.test(amount.trim());
    }

    const onAmountBlur = () => {
        if (!isValidAmountFormat(amount)) return;
        setAmount(parseFloat(normalizedAmount).toFixed(2));
    };

    const onSubmit = async (e) => {
        e.preventDefault();

        const errs = [];
        if (!title.trim()) errs.push( { message: 'Ticket title is required' } );
        if (!isValidAmountFormat(amount)) {
            errs.push({ message: 'Invalid price' });
        } else if (parseFloat(normalizedAmount) <= 0) {
            errs.push({ message: 'Price must be > 0' });
        }
        if (errs.length) {
            setValidationErrors(errs);
            return;
        }

        setValidationErrors(null);
        await doRequest();
    }

    return (
        <div>
            <h1>New Ticket</h1>
            <form onSubmit={onSubmit}>
                <div className="form-group">
                    <label>Title</label>
                    <input id="title" value={title} onChange={e => setTitle(e.target.value)} className="form-control" type="text" />
                </div>
                <div className="form-group">
                    <label>Price</label>
                    <input id="price" value={amount} onChange={e => setAmount(e.target.value)} onBlur={onAmountBlur} className="form-control" type="text" inputMode="decimal" />
                </div>
                <div className="form-group">
                    <label>Currency</label>
                    <select id="currency" value={currency} onChange={e => setCurrency(e.target.value)} className="form-control">
                        {CURRENCIES.map(({ code, symbol }) => (
                            <option key={code} value={code}>{code} {symbol}</option>
                        ))}
                    </select>
                </div>
                <button className="btn btn-primary">Create</button>
                <ErrorAlert errors={validationErrors ?? requestErrors} />
            </form></div>
    );
};

export default CreateTicket;
