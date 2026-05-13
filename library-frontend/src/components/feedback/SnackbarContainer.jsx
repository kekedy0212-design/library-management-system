import { createPortal } from 'react-dom';
import '@material/web/iconbutton/icon-button.js';
import '@material/web/icon/icon.js';
import './snackbar.css';

export default function SnackbarContainer({ snackbars, removeSnackbar }) {
    return createPortal(
        <div className="snackbar-root">
            <div className="snackbar-stack">
                {snackbars.map(item => (
                    <div
                        key={item.id}
                        className={`snackbar ${item.type || 'info'}`}
                    >
                        <div className="snackbar-message">
                            {item.message}
                        </div>

                        {/* 使用 Icon Button 替代文字按钮 */}
                        <md-icon-button
                            className="snackbar-close-btn"
                            onClick={() => removeSnackbar(item.id)}
                        >
                            <md-icon>close</md-icon>
                        </md-icon-button>
                    </div>
                ))}
            </div>
        </div>,
        document.body
    );
}