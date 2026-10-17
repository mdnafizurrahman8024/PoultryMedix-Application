import { createContext, useCallback, useContext, useMemo, useState } from 'react'

export const USER_ROLES = ['FARMER', 'VET_STUDENT', 'REGISTERED_VET']
const roleStorageKey = 'poultry-medix-user-role'

const UserContext = createContext(null)

function getStoredRole() {
  try {
    const storedRole = localStorage.getItem(roleStorageKey)
    return USER_ROLES.includes(storedRole) ? storedRole : null
  } catch (error) {
    console.error('Unable to restore the saved user role.', error)
    return null
  }
}

export function UserProvider({ children }) {
  const [userContext, setUserContext] = useState({
    isLoggedIn: false,
    role: getStoredRole(),
  })

  const setRole = useCallback((role) => {
    if (!USER_ROLES.includes(role)) return
    setUserContext((current) => ({ ...current, role }))
    try {
      localStorage.setItem(roleStorageKey, role)
    } catch (error) {
      console.error('Unable to save the selected user role.', error)
    }
  }, [])

  const setLoggedIn = useCallback((isLoggedIn) => {
    setUserContext((current) => ({ ...current, isLoggedIn }))
  }, [])

  const value = useMemo(() => ({
    ...userContext,
    setRole,
    setLoggedIn,
  }), [setLoggedIn, setRole, userContext])

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export function useUser() {
  const context = useContext(UserContext)
  if (!context) throw new Error('useUser must be used within a UserProvider')
  return context
}
