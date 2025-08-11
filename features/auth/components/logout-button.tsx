import React from 'react'
import { LogoutButtonProps } from '../types'
import { useRouter } from 'next/navigation'
// HACKATHON: Temporarily disabled auth
// import { signOut } from 'next-auth/react';

const LogoutButton = ({children}:LogoutButtonProps) => {
    const router = useRouter();
    const onLogout = async()=>{
        // HACKATHON: Mock logout - just refresh page
        router.refresh()
        
        // Original auth code (commented for hackathon)
        // await signOut()
        // router.refresh()
    }
  return (
    <span className='cursor-pointer' onClick={onLogout}>
        {children}
    </span>
  )
}

export default LogoutButton