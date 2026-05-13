import { createPortal } from 'react-dom';

import '@material/web/button/text-button.js';

import './snackbar.css';

export default function SnackbarContainer({
    snackbars,
    removeSnackbar,
}) {

    return createPortal(

        <div className="snackbar-root">

            <div className="snackbar-stack">

                {snackbars.map(item => (

                    <div
                        key={item.id}
                        className={`snackbar ${item.type}`}
                    >

                        <div className="snackbar-message">
                            {item.message}
                        </div>

                        <md-text-button
                            onClick={() =>
                                removeSnackbar(item.id)
                            }
                        >
                            Close
                        </md-text-button>

                    </div>

                ))}

            </div>

        </div>,

        document.body
    );
}