import React from 'react'
import { SquarePlus, Trash2 } from 'lucide-react'

export default function DeviceSidebar({ devices, activeDeviceId, toggleSelectedDevice, openAddModal, openDeleteModal, addDisabled, canDeleteDevice, dataSource, getMatchTone }) {
  return (
    <aside className="project-device-panel">
      <div className="project-panel-head project-panel-head-actions">
        <div>
          <h2>Devices</h2>
          <span>{devices.length} registered</span>
        </div>
        <div className="project-toolbar-actions">
          <button type="button" className="project-action-btn" disabled={addDisabled} onClick={openAddModal}>
            <SquarePlus size={18} strokeWidth={1.8} /> Add
          </button>
          <button type="button" className="project-action-btn" disabled={!canDeleteDevice} onClick={openDeleteModal}>
            <Trash2 size={18} strokeWidth={1.8} /> Delete
          </button>
        </div>
      </div>
      <div className="project-device-list">
        {devices.map((device) => {
          const isActive = activeDeviceId === device.id
          return (
            <button key={device.id} type="button" className={`project-device-card ${isActive ? 'is-active' : ''}`} onClick={() => toggleSelectedDevice(device.id)}>
              <div className="project-device-card-top">
                <strong>{device.name}</strong>
                <span>{device.tags.length} tags</span>
              </div>
              <div className="project-device-card-meta">
                <span>{device.properties.find((property) => property.label === 'Device Type')?.value || 'Device'}</span>
                <span>{dataSource === 'mqtt' ? getMatchTone(device) : device.items.find((item) => item.kind === 'block')?.label || 'Block(0)'}</span>
              </div>
            </button>
          )
        })}
      </div>
    </aside>
  )
}