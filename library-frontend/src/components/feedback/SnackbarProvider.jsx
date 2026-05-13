import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
} from 'react';

import SnackbarContainer from './SnackbarContainer';

const SnackbarContext = createContext(null);

export function SnackbarProvider({
    children,
}) {

    const [snackbars, setSnackbars] =
        useState([]);

    const removeSnackbar = useCallback((id) => {

        setSnackbars(prev =>
            prev.filter(item => item.id !== id)
        );

    }, []);

    const showSnackbar = useCallback((
        message,
        type = 'info',
        duration = 10000,
    ) => {

        const id = crypto.randomUUID();

        setSnackbars(prev => {

            return [
                ...prev,
                {
                    id,
                    message,
                    type,
                }
            ];
        });
        window.setTimeout(() => {
            removeSnackbar(id);
        }, duration);

    }, [removeSnackbar]);

    const value = useMemo(() => ({
        showSnackbar,
    }), [showSnackbar]);

    return (
        <SnackbarContext.Provider value={value}>

            {children}

            <SnackbarContainer
                snackbars={snackbars}
                removeSnackbar={removeSnackbar}
            />

        </SnackbarContext.Provider>
    );
}

export function useSnackbar() {

    const context =
        useContext(SnackbarContext);

    if (!context) {
        throw new Error(
            'useSnackbar must be used within SnackbarProvider'
        );
    }

    return context;
}