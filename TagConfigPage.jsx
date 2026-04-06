import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTagManager } from './hooks/useTagManager'
import TagTopBar from './components/tag-page/topbar'
import TagToolbar from './components/tag-page/toolbar'
import TagTable from './components/tag-page/tagtable'
import TagFormModal from './components/tag-page/tagformmodal'
import './project-tag-config-page.css'

export default function TagConfigPage({ user, onSignOut }) {
  const navigate = useNavigate()
  const { deviceId } = useParams()
  const manager = useTagManager(deviceId)

  if (!manager.activeDevice) return null

  return (
    <main className={`project-tag-page ${manager.isDarkMode ? 'is-dark' : ''}`}>
      <TagTopBar 
        navigate={navigate}
        time={manager.time}
        isDarkMode={manager.isDarkMode}
        setIsDarkMode={manager.setIsDarkMode}
        user={user}
        onSignOut={onSignOut}
      />

      <section className="project-tag-content">
        <TagToolbar manager={manager} />
        <TagTable manager={manager} />
      </section>

      <TagFormModal manager={manager} />
    </main>
  )
}