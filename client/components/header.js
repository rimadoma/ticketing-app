import Link from 'next/link'

const Header = ({ currentUser }) => {
    const links = [];
    if (!currentUser) {
        links.push({ key: 'signup', label: 'Sign up', href: '/auth/signup' });
        links.push({ key: 'signin', label: 'Sign in', href: '/auth/signin' });
    } else {
        links.push({ key: 'createticket', label: 'New ticket', href: '/tickets/create' });
        links.push({ key: 'signout', label: 'Sign out', href: '/auth/signout' });
    }

    return (
        <nav className="navbar navbar-light bg-light">
            <Link className="navbar-brand" href="/">GitTix</Link>

            <div className="d-flex justify-content-end">
                <ul className="nav d-flex align-items-center">
                    {links.map(({ key, label, href }) => (
                        <li key={key} className="nav-item">
                            <Link href={href} className='nav-link'>{label}</Link>
                        </li>
                    ))}
                </ul>
            </div>
        </nav>
    );
};

export default Header;