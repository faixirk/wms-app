if(NOT TARGET hermes-engine::hermesvm)
add_library(hermes-engine::hermesvm SHARED IMPORTED)
set_target_properties(hermes-engine::hermesvm PROPERTIES
    IMPORTED_LOCATION "/Users/nextbyte/.gradle/caches/9.0.0/transforms/4af1843d2d9370a4eaa03f502c11b16c/transformed/hermes-android-250829098.0.7-debug/prefab/modules/hermesvm/libs/android.x86/libhermesvm.so"
    INTERFACE_INCLUDE_DIRECTORIES "/Users/nextbyte/.gradle/caches/9.0.0/transforms/4af1843d2d9370a4eaa03f502c11b16c/transformed/hermes-android-250829098.0.7-debug/prefab/modules/hermesvm/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

