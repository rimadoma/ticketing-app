import Link from 'next/link'
import { CURRENCIES } from '../constants';

const LandingPage = ({ currentUser, tickets }) => {
    const rows = tickets.map(ticket => {
        const symbol = CURRENCIES.find(c => c.code === ticket.price.currency)?.symbol ?? '';
        const price = `${symbol}${ticket.price.amount} `;
        const ticketUrl = `/tickets/${ticket.id}`;

        return (
            <tr key={ticket.id}>
                <td>{ticket.title}</td>
                <td>{price}</td>
                <td><Link href={ticketUrl}>View</Link></td>
            </tr>
        );
    });

    // TODO show whether tickets are free, reserved, or sold
    return (
        <div>
            <h1>Tickets</h1>
            <table className="table">
                <thead>
                    <tr>
                        <th>Title</th>
                        <th>Price</th>
                        <th>Link</th>
                    </tr>
                </thead>
                <tbody>{rows}</tbody>
            </table>
        </div>
    );
};

LandingPage.getInitialProps = async (context, client, currentUser) => {
    const { data } = await client.get('/api/tickets');

    return { tickets: data };
}

export default LandingPage;
