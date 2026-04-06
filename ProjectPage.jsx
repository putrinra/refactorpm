import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjectManager } from './hooks/useProjectManager'
import ProjectTopBar from './components/project-page/topbar'
import DeviceSidebar from './components/project-page/sidebar'
import DeviceDetails from './components/project-page/devicedetails'
import DeviceModals from './components/project-page/devicemodal'
import './project-page.css'

function ProjectPage({ user, onSignOut }) {
  const navigate = useNavigate()
  const manager = useProjectManager(navigate)

  return (
    <main className={`project-page ${manager.isDarkMode ? 'is-dark' : ''}`}>
      <ProjectTopBar 
        isDarkMode={manager.isDarkMode} 
        setIsDarkMode={manager.setIsDarkMode} 
        time={manager.time} 
        user={user} 
        onSignOut={onSignOut} 
        navigate={navigate} 
      />

      <section className="project-content">
        <div className="project-layout">
          <DeviceSidebar 
            devices={manager.devices}
            activeDeviceId={manager.activeDeviceId}
            toggleSelectedDevice={manager.toggleSelectedDevice}
            openAddModal={manager.openAddModal}
            openDeleteModal={manager.openDeleteModal}
            addDisabled={manager.addDisabled}
            canDeleteDevice={manager.canDeleteDevice}
            dataSource={manager.dataSource}
            getMatchTone={manager.getMatchTone}
          />

          <div className="project-main-panel">
            <DeviceDetails 
              activeDevice={manager.activeDevice}
              activeDeviceItems={manager.activeDeviceItems}
              visibleActiveDeviceProperties={manager.visibleActiveDeviceProperties}
              dataSource={manager.dataSource}
              editDisabled={manager.editDisabled}
              openEditModal={manager.openEditModal}
              openTagConfiguration={manager.openTagConfiguration}
            />
          </div>
        </div>
      </section>

      <DeviceModals manager={manager} />
    </main>
  )
}

export default ProjectPage