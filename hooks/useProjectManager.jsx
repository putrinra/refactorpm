import { useEffect, useMemo, useState } from 'react'
import { message } from 'antd'
import {buildDeviceItems, createDeviceFormState, getDevicePropertySchema, loadProjectDevices, saveProjectDevices} from '../projectStorage.js'
import {connectProjectStream, fetchProjectDevices, subscribeProjectDevice, unsubscribeProjectDevice, updateProjectDevice} from '../../../api/projectApi.js'

export function useProjectManager(navigate) {
  const [devices, setDevices] = useState(() => loadProjectDevices())
  const [activeDeviceId, setActiveDeviceId] = useState(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [time, setTime] = useState('')
  const [addForm, setAddForm] = useState(() => createDeviceFormState('Modicon'))
  const [editForm, setEditForm] = useState({})
  const [dataSource, setDataSource] = useState('dummy')

  function applyBackendDevices(response) {
    const apiDevices = Array.isArray(response?.devices) ? response.devices : []
    const nextSource = response?.source === 'mqtt' ? 'mqtt' : 'dummy'

    setDataSource(nextSource)

    if (nextSource === 'mqtt') {
      setDevices(apiDevices)
      setActiveDeviceId((prev) => {
        if (prev && apiDevices.some((device) => device.id === prev)) {
          return prev
        }
        return apiDevices[0]?.id ?? null
      })
    }
  }

  async function refreshProjectDevices() {
    const response = await fetchProjectDevices()
    applyBackendDevices(response)
    return response
  }

  function toggleSelectedDevice(deviceId) {
    setActiveDeviceId((prev) => (prev === deviceId ? null : deviceId))
  }

  const activeDevice = devices.find((device) => device.id === activeDeviceId) ?? null

  function openEditModal() {
    if (!activeDevice) return

    setEditForm(
      createDeviceFormState(
        activeDevice.properties.find((property) => property.label === 'Device Type')?.value || 'Modicon',
        activeDevice.properties.reduce((accumulator, property) => {
          accumulator[property.label] = property.value
          return accumulator
        }, {}),
      ),
    )
    setIsEditModalOpen(true)
  }

  function handleAddFieldChange(label, value) {
    setAddForm((prev) => {
      if (label === 'Device Type') {
        return createDeviceFormState(value, { ...prev, [label]: value })
      }
      return { ...prev, [label]: value }
    })
  }

  function handleEditFieldChange(label, value) {
    setEditForm((prev) => {
      if (label === 'Device Type') {
        return createDeviceFormState(value, { ...prev, [label]: value })
      }
      return { ...prev, [label]: value }
    })
  }

  function buildPropertiesFromForm(formState) {
    return getDevicePropertySchema(formState['Device Type'] || 'Modicon').map((property) => ({
      label: property.label,
      value: formState[property.label] ?? property.value,
    }))
  }

  function handleEditSubmit(event) {
    event.preventDefault()
    if (!activeDevice) return

    if (dataSource === 'mqtt') {
      const properties = buildPropertiesFromForm(editForm)
      const nextDeviceName = editForm['Device Name'] || activeDevice.name

      updateProjectDevice(activeDevice.name, properties)
        .then(() => refreshProjectDevices())
        .then((response) => {
          const updatedDevice = response?.devices?.find((device) => device.name === nextDeviceName)
          if (updatedDevice) {
            setActiveDeviceId(updatedDevice.id)
          }
          setIsEditModalOpen(false)
          message.success(`Updated device configuration for "${nextDeviceName}".`)
        })
        .catch((error) => {
          message.error(error?.response?.data?.detail || 'Failed to update device configuration.')
        })
      return
    }

    setDevices((prev) =>
      prev.map((device) =>
        device.id === activeDeviceId
          ? {
              ...device,
              name: editForm['Device Name'] || device.name,
              properties: device.properties.map((property) => ({
                ...property,
                value: editForm[property.label] ?? property.value,
              })),
            }
          : device,
      ),
    )

    setIsEditModalOpen(false)
  }

  function handleAddSubmit(event) {
    event.preventDefault()

    if (dataSource === 'mqtt') {
      const properties = buildPropertiesFromForm(addForm)
      const deviceName = addForm['Device Name'] || 'Device'

      subscribeProjectDevice(properties)
        .then(() => refreshProjectDevices())
        .then((response) => {
          const addedDevice = response?.devices?.find((device) => device.name === deviceName)
          if (addedDevice) {
            setActiveDeviceId(addedDevice.id)
          }
          setIsAddModalOpen(false)
          message.success(`Added device configuration for "${deviceName}".`)
        })
        .catch((error) => {
          message.error(error?.response?.data?.detail || 'Failed to subscribe device.')
        })
      return
    }

    const nextId = devices.length ? Math.max(...devices.map((device) => device.id)) + 1 : 1
    const nextItemId = devices.flatMap((device) => device.items).length
      ? Math.max(...devices.flatMap((device) => device.items).map((item) => item.id)) + 1
      : 1

    const nextDevice = {
      id: nextId,
      name: addForm['Device Name'] || `Device ${nextId}`,
      properties: Object.entries(addForm).map(([label, value]) => ({ label, value })),
      tags: [],
      items: [
        { id: nextItemId, kind: 'tag', label: 'Tag(0)', tagGroupId: `device-${nextId}-tags` },
        { id: nextItemId + 1, kind: 'block', label: 'Block(0)' },
      ],
    }

    setDevices((prev) => [...prev, nextDevice])
    setActiveDeviceId(nextId)
    setIsAddModalOpen(false)
  }

  function handleDeleteDevice() {
    if (!activeDevice) return

    if (dataSource === 'mqtt') {
      unsubscribeProjectDevice(activeDevice.name)
        .then(() => refreshProjectDevices())
        .then(() => {
          setIsDeleteModalOpen(false)
          message.success(`Unsubscribed device "${activeDevice.name}".`)
        })
        .catch((error) => {
          message.error(error?.response?.data?.detail || 'Failed to unsubscribe device.')
        })
      return
    }

    setDevices((prev) => prev.filter((device) => device.id !== activeDevice.id))
    setActiveDeviceId(null)
    setIsDeleteModalOpen(false)
  }

  function openTagConfiguration(device, item) {
    if (item.kind !== 'tag') return

    navigate(`/project/tag/${device.id}/${item.id}`, {
      state: {
        deviceName: device.name,
        tagLabel: item.label,
        tags: device.tags || [],
      },
    })
  }

  function getMatchTone(device) {
    if (device?.matchStatus === 'matched') return 'Matched'
    if (device?.matchStatus === 'mismatch') return 'Mismatch'
    return 'Waiting'
  }

  const canAddDevice = dataSource === 'mqtt' ? true : activeDeviceId === null
  const canDeleteDevice = devices.some((device) => device.id === activeDeviceId)
  const activeDeviceItems = useMemo(() => (activeDevice ? buildDeviceItems(activeDevice) : []), [activeDevice])
  const activeDeviceType = activeDevice?.properties.find((property) => property.label === 'Device Type')?.value || 'Modicon'
  const visibleActiveDeviceProperties = useMemo(() => {
    const visibleLabels = new Set(getDevicePropertySchema(activeDeviceType).map((property) => property.label))
    return (activeDevice?.properties || []).filter((property) => visibleLabels.has(property.label))
  }, [activeDevice, activeDeviceType])

  const addFormFields = useMemo(() => getDevicePropertySchema(addForm['Device Type'] || 'Modicon'), [addForm])
  const editFormFields = useMemo(() => getDevicePropertySchema(editForm['Device Type'] || activeDeviceType), [editForm, activeDeviceType])

  useEffect(() => {
    if (dataSource !== 'mqtt') {
      saveProjectDevices(devices)
    }
  }, [devices, dataSource])

  useEffect(() => {
    let isMounted = true

    fetchProjectDevices()
      .then((response) => {
        if (!isMounted) return
        applyBackendDevices(response)
      })
      .catch(() => {
        if (!isMounted) return
        setDataSource('dummy')
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    const stream = connectProjectStream((response) => {
      applyBackendDevices(response)
    })

    return () => {
      stream.close()
    }
  }, [])

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date()
      const options = {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }
      setTime(now.toLocaleString('en-GB', options).replace(',', ''))
    }

    updateDateTime()
    const timer = setInterval(updateDateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  return {
    devices, activeDeviceId, activeDevice, activeDeviceItems, visibleActiveDeviceProperties, isAddModalOpen, setIsAddModalOpen,
    openAddModal: () => {
      setAddForm(createDeviceFormState('Modicon'))
      setIsAddModalOpen(true)
    },
    closeAddModal: () => setIsAddModalOpen(false),
    isEditModalOpen, setIsEditModalOpen, openEditModal,
    closeEditModal: () => setIsEditModalOpen(false),
    isDeleteModalOpen,setIsDeleteModalOpen,
    openDeleteModal: () => activeDevice && setIsDeleteModalOpen(true),
    closeDeleteModal: () => setIsDeleteModalOpen(false),
    isDarkMode, setIsDarkMode, time, dataSource, addForm, editForm, addFormFields, editFormFields, handleAddFieldChange, handleEditFieldChange,
    handleAddSubmit, handleEditSubmit, handleDeleteDevice, toggleSelectedDevice, openTagConfiguration, getMatchTone, canAddDevice, canDeleteDevice,
    addDisabled: !canAddDevice,
    editDisabled: !activeDevice,
  }
}
