import { createContext, useContext } from 'react'

export const USER_ROLES = ['FARMER', 'VET_STUDENT', 'REGISTERED_VET']

export const UserContext = createContext(null)

export function useUser() {
  const context = useContext(UserContext)
  if (!context) throw new Error('useUser must be used within a UserProvider')
  return context
}
